/* /3D Wedding Invitation Sample 2/share.html?c=…
   Cloudflare Pages route for the SSR link card. On Netlify this path arrives
   via a _redirects rewrite to the card function; Cloudflare runs Functions
   before _redirects, so the route is a real Function here that sets
   template=sample2 and hands the request to the same api/card.js handler. */
const { cfBridge } = require("../_cf_bridge");
const card = require("../../api/card");
export const onRequest = cfBridge(card, {
  extraQuery: () => ({ template: "sample2" }),
});
