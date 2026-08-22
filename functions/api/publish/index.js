const { cfBridge } = require("../../_cf_bridge");
const publish = require("../../../api/publish/index");
export const onRequest = cfBridge(publish);
