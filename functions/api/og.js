const { cfBridge } = require("../_cf_bridge");
const og = require("../../api/og");
export const onRequest = cfBridge(og);
