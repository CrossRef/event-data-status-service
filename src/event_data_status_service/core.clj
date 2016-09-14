(ns event-data-status-service.core
  "Status Service. Keeps per-minute counts of service/component/facet activity. Examples:
   - wikipedia/input-stream/input-event
   - wikipedia/restbase/request
   - wikipedia/restbase/response-ok
   - wikipedia/restbase/reponse-error
   - wikipedia/events/evidence-created
   - wikipedia/events/evidence-pushed
   - wikipedia/events/event-occurred
  
  Stored in Redis in JSON structures in per-day buckets. e.g. 
  
  Key: 2018-09-20
  Value: {'wikipedia':{'input-stream':{'input':{'2016-09-09:11:36':17},'output':{'2016-09-09:11:36':1}}}}
  
  A channel is used to serialize access to the bucket.
  "
  (:require [clojure.data.json :as json]
            [clojure.core.async :refer [>!! <!! <! chan go-loop]]
            [clojure.tools.logging :as log]
            [clojure.walk :refer [postwalk]])
  (:require [config.core :refer [env]]
            [liberator.core :as l]
            [compojure.core :as c]
            [compojure.route :as r]
            [org.httpkit.server :as server]
            [ring.middleware.params :refer [wrap-params]]
            [clj-time.coerce :as coerce]
            [clj-time.core :as clj-time]
            [clj-time.format :as format]
            [clj-time.periodic :as periodic]
            [overtone.at-at :as at-at])
  (:import [redis.clients.jedis Jedis JedisPool JedisPoolConfig])
  (:gen-class))

; Consts

(def ymd (format/formatter "yyyy-MM-dd"))
(def ymdhm (format/formatter "yyyy-MM-dd:HH:mm"))

(def day-key-prefix "__status__day__")
(def pubsub-key "__status__pubsub__")

(defn filter-at-4-levels
  "Walk a nested map structure 4 levels deep, apply the key-filter function at the 4th level.
  Return sorted maps along the way."
  [s key-value-filter]
 (into (sorted-map)
    (map
      (fn [[k-1 v-1]]
        [k-1 (into (sorted-map)
                   (map (fn [[k-2 v-2]]
                          [k-2 (into (sorted-map)
                                     (map (fn [[k-3 v-3]]
                                            [k-3 (into (sorted-map) (filter key-value-filter v-3))])
                                          v-2))])
                        v-1))])
     s)))

; Redis

(defn make-jedis-pool
  []
  ; Nice big pool in case we have multiple threads trying to interact with multiple queues.
  ; Real chance of deadlock otherwise!
  (let [pool-config (new org.apache.commons.pool2.impl.GenericObjectPoolConfig)]
    (.setMaxTotal pool-config 100)
  (new JedisPool pool-config (:redis-host env) (Integer/parseInt (:redis-port env)))))

(def jedis-pool
  (delay (make-jedis-pool)))

(defn get-connection
  "Get a Redis connection from the pool. Must be closed."
  []
  (let [resource (.getResource @jedis-pool)]
    (.select resource (Integer/parseInt (:redis-db-number env)))
    resource))

; Auth
; Tokens are comma-separated in the config.
(def auth-tokens (delay (set (.split (:auth-tokens env) ","))))

; Workers

; Channel to handle updates.
(def status-updates-chan (chan))

; Helpers
(defn update-bucket-data
  "Update a date bucket. Read JSON, update time, re-serialize.
  Also maintain the status/activity/total and status/activity/updates counts.
  "
  [before now-date-str service component facet increment-count]
  (let [structure (json/read-str (or before "{}"))
        structure (update-in structure [service component facet now-date-str] (fnil #(+ % increment-count) 0))
        structure (update-in structure ["status-service" "activity" "total" now-date-str] (fnil #(+ % increment-count) 0))
        structure (update-in structure ["status-service" "activity" "updates" now-date-str] (fnil inc 0))]
    (json/write-str structure)))

; Serve up status page for today, a given date, with history.
; - the days option serves up full calendar days
; - the hours option serves up full calendar hours
(l/defresource status-page
  [date-str]
  :available-media-types ["application/javascript"]
  :malformed? (fn [ctx]
                (try
                  (let [date (if date-str
                               (format/parse ymd date-str)
                               (clj-time/now))
                        days (when-let [days-str (get-in ctx [:request :params "days"])] (Integer/parseInt days-str))
                        hours (when-let [hours-str (get-in ctx [:request :params "hours"])] (Integer/parseInt hours-str))]
                    [false {::date date
                            ::days days
                            ::hours hours}])
                (catch IllegalArgumentException _ true)))
  
  :exists? (fn [ctx]
             (with-open [conn (get-connection)]
               (let [days-buckets (cond
                                    ; If days supplied, take them.
                                    (::days ctx) (::days ctx)
                                    
                                    ; If hours supplied, enough days to cover the hours.
                                    ; Data is stored in per-day buckets.
                                    (::hours ctx) (int (Math/ceil (/ (::hours ctx) 24)))
                                    
                                    ; Otherwise just take the last day.
                                    :default 1)
                     
                     ; If hours were supplied, generate a cutoff date for the buckets.
                     earliest-date (when (::hours ctx)
                                     (clj-time/minus (clj-time/now)
                                        (clj-time/hours (::hours ctx))))
                     
                     bucket-day-range (reverse (take days-buckets (periodic/periodic-seq (::date ctx) (clj-time/days -1))))
                     
                     day-str-range (map (partial format/unparse ymd) bucket-day-range)
                     
                     ; Get seq of structures.
                     days-serialized (map #(.get conn (str day-key-prefix %)) day-str-range)
                     all-exist? (not-any? empty? days-serialized)
                     
                     ; days-data is a seq of buckets of complete structure in JSON
                     days-data (map json/read-str days-serialized)
                     
                     ; because the structures are maps with disjoint keys at the fourth level (service => component => facet => date => count)
                     ; we just need to utter the magic words "apply merge-with partial merge-with partial merge-with merge".
                     all-data (apply merge-with (partial merge-with (partial merge-with merge)) days-data)
                     
                     ; Filter out dates that we don't want. They're nested at the 4th level.
                     filtered (filter-at-4-levels all-data (if-not earliest-date
                                                               (constantly true)
                                                               (fn [[date-key v]]
                                                                 (clj-time/after? (format/parse ymdhm date-key) earliest-date))))]
                 [all-exist? {::data filtered}])))
  
  :handle-ok (fn [ctx]              
              (json/write-str
                {:type "event-data-status"
                 :data (::data ctx)})))

; Accept new data.
(l/defresource post-status
 [service component facet]
 :allowed-methods [:post]
 :available-media-types ["text/plain"]
 :allowed? (fn [ctx]
             (:allowed-updates env))
 :authorized? (fn [ctx]
                (try
                  (@auth-tokens
                    (nth (re-find #"Token (.*)" (get-in ctx [:request :headers "authorization"])) 1))
                  ; NPE if not found.
                  (catch NullPointerException _ false)))
 :malformed? (fn [ctx]
               (let [value (Integer/parseInt (slurp (get-in ctx [:request :body])))]
                 [false {::value value}]))
 :handle-ok "ok"
 :post! (fn [ctx]
          (log/info "Accept" service component facet (::value ctx))
            (let [date-bucket (str day-key-prefix (format/unparse ymd (clj-time/now)))]
              (>!! status-updates-chan [date-bucket service component facet (::value ctx)]))))



(c/defroutes routes
  (c/GET "/status/:date-str" [date-str] (status-page date-str))
  (c/GET "/status" [] (status-page nil))
  (c/POST "/status/:service/:component/:facet" [service component facet] (post-status service component facet)))

(def app
  (-> routes
      (wrap-params)))

(def schedule-pool (at-at/mk-pool))

(defn -main
  [& args]
  
  (if (:allowed-updates env)
    (log/info "Start Status service, updates allowed.")
    (log/info "Start Status service, read only"))
  
  (when (:allowed-updates env)
    ; Loop over updates and apply them. Because data is stored in a bucket per day, this requires bucket-level locking
    ; which is achieved by a single goroutine performing the update.
    (go-loop [[date-bucket service component facet increment-count] (<!! status-updates-chan)]
      (with-open [connection (get-connection)]
        (let [before (.get connection date-bucket)
              updated (update-bucket-data before (format/unparse ymdhm (clj-time/now)) service component facet increment-count)]
          (.set connection date-bucket updated)))
        (recur (<! status-updates-chan)))

    ; Keep a timer going to show the evidence service is still up!
    ; Also useful when there is more than once load-balanced instance.
    (at-at/every 60000 (fn []
                         (let [date-bucket (str day-key-prefix (format/unparse ymd (clj-time/now)))]
                           (>!! status-updates-chan [date-bucket "status-service" "heartbeat" "tick" 1])))
                 schedule-pool))
  
  (server/run-server app {:port (Integer/parseInt (:port env))}))
