package eventdata;

import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPubSub;
import clojure.lang.IFn;

public class PubSubClient extends JedisPubSub {
  private IFn callback;

  public PubSubClient(IFn callback) {
    super();
    this.callback = callback;
  }  

  public void onMessage(String channel, String message) {
    this.callback.invoke(channel, message);
  }

  public void onSubscribe(String channel, int subscribedChannels) {
  }

  public void onUnsubscribe(String channel, int subscribedChannels) {
  }

  public void onPSubscribe(String pattern, int subscribedChannels) {
  }

  public void onPUnsubscribe(String pattern, int subscribedChannels) {
  }

  public void onPMessage(String pattern, String channel, String message) {
  }
}