const { cfBridge } = require("../../_cf_bridge");
const preflight = require("../../../api/publish/preflight");
export const onRequest = cfBridge(preflight);
