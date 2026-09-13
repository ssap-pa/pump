import handler from 'vinext/server/fetch-handler';
import {renewSubscriptions} from './lib/billing';
export default {
  fetch:handler.fetch,
  async scheduled(_controller:ScheduledController,env:Cloudflare.Env){await renewSubscriptions(env);},
};
