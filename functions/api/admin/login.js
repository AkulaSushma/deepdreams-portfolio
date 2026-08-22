const { cfBridge } = require("../../_cf_bridge");
const login = require("../../../api/admin/login");
export const onRequest = cfBridge(login);
