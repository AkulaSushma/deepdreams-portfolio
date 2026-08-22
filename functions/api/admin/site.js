const { cfBridge } = require("../../_cf_bridge");
const site = require("../../../api/admin/site");
export const onRequest = cfBridge(site);
