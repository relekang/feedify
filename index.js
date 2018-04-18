const cheerio = require("cheerio");
const request = require("superagent");
const url = require("url");

module.exports = async function handler(req, res) {
  const { pathname, query } = url.parse(req.url, /* parseQueryString */ true);
  const response = await request.get(query.url);

  console.log(query);

  const $ = cheerio.load(response.text);
  return $(query.mainSelector)
    .find(query.itemSelector)
    .map((index, element) => {
      const title = $(element)
        .find(query.titleSelector)
        .text();
      const link = $(element)
        .find(query.linkSelector)
        .text();
      const description = $(element)
        .find(query.descriptionSelector)
        .text()
        .trim();

      return { title, link, description };
    })
    .get()
    .filter(item => item.title);
};
