const { cfBridge } = require("../../_cf_bridge");
const recover = require("../../../api/publish/recover");
export const onRequest = cfBridge(recover);
