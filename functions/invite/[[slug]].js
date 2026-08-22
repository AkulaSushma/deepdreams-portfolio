const { cfBridge } = require("../_cf_bridge");
const invite = require("../../api/invite");
export const onRequest = cfBridge(invite, {
  extraQuery: (context) => {
    const slug = context.params.slug;
    const slugVal = Array.isArray(slug) ? slug.join("/") : slug;
    return { slug: slugVal };
  }
});
