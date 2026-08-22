const { cfBridge } = require("../_cf_bridge");
const card = require("../../api/card");
export const onRequest = cfBridge(card);
