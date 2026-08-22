const { cfBridge } = require("../../_cf_bridge");
const tokens = require("../../../api/admin/tokens");
export const onRequest = cfBridge(tokens);
