const { send } = require("micro");
const { validator } = require("cicero-form-validator");
const cheerio = require("cheerio");
const request = require("superagent");
const rss = require("rss");
const url = require("url");

const validate = data => {
  const config = {
    url: { required: true },
    mainSelector: { required: true },
    itemSelector: { required: true },
    titleSelector: { required: true },
  };
  return validator(config)(Object.keys(config), data);
};

function format({query, title, items, res}) {
  switch (query.format) {
    case "json":
      return {title, url: query.url, items};

    case "rss":
    default:
      res.setHeader('Content-Type', 'application/atom+xml; charset=utf-8')
      return new rss({title, url: query.url}, items.map(item => ({ ...item, categories: [] }))).xml();
  }
}

module.exports = async function handler(req, res) {
  const { pathname, query } = url.parse(req.url, /* parseQueryString */ true);

  const errors = validate(query);
  if (Object.keys(errors).length) {
    return send(res, 400, { message: "There is validation errors", errors });
  }

  const response = await request.get(query.url);
  const $ = cheerio.load(response.text);

  const title = $('title').text().trim()

  const items = $(query.mainSelector)
    .find(query.itemSelector)
    .map((index, element) => {
      const title = $(element)
        .find(query.titleSelector)
        .text();
      const url = $(element)
        .find(query.linkSelector)
        .text() || query.url;
      const description = $(element)
        .find(query.descriptionSelector)
        .text()
        .trim();

      return { title, url, description };
    })
    .get()
    .filter(item => item.title);

  return format({query, title, items, res});
};
