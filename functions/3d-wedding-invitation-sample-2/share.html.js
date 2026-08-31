/* /3d-wedding-invitation-sample-2/share.html?c=…
   Alias of /3D Wedding Invitation Sample 2/share.html — the lowercase form
   guests type by hand. Same card handler, same template. */
const { cfBridge } = require("../_cf_bridge");
const card = require("../../api/card");
export const onRequest = cfBridge(card, {
  extraQuery: () => ({ template: "sample2" }),
});
