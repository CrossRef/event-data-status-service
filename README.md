# Event Data Status Service

## Config


 - `:port` e.g. "9998"
 - `:service-base` e.g. "http://localhost:9998"
 - `:redis-db-number` e.g. "1"
 - `:redis-host` e.g. "localhost"
 - `:redis-port` e.g. "6379"
 - `:auth-tokens` e.g. "AUTH1,AUTH2,AUTH3"


## Development

Send a test event:

    curl http://localhost:9998/status/wikipedia/input-stream/input --verbose -X POST -H "Authoriation: Token AUTH3" -H "Content-Type: text/plain" --data "5"  