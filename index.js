const { send } = require("micro");
const { validator } = require("cicero-form-validator");
const cheerio = require("cheerio");
const request = require("superagent");
const rss = require("rss");
const url = require("url");
const { renderToString } = require("react-dom/server");
const React = require("react");
const sentenceCase = require("sentence-case");
const { parseDate } = require('chrono-node')
const { createElement } = React;

const validate = data => {
  const config = {
    url: { required: true },
    mainSelector: { required: true },
    itemSelector: { required: true },
    titleSelector: { required: true },
  };
  return validator(config)(Object.keys(config), data);
};

async function fetchFeed({ query }) {
  const response = await request.get(query.url);
  const $ = cheerio.load(response.text);
  console.log(response.text);

  const title = $("title")
    .text()
    .trim();

  const items = $(query.mainSelector)
    .find(query.itemSelector)
    .map((index, element) => {
      const title = $(element)
        .find(query.titleSelector)
        .text();
      const url =
        $(element)
          .find(query.linkSelector)
          .text() || query.url;
      const date = parseDate($(element)
        .find(query.dateSelector)
        .text()
        .trim());
      const description = $(element)
        .find(query.descriptionSelector)
        .text()
        .trim();

      return { title, url, date: date ? date.toISOString() : date, description };
    })
    .get()
    .filter(item => item.title);

  return { title, items };
}

function ui({ query, title, items }) {
  return renderToString(
    createElement(
      "div",
      { style: { width: "500px", margin: "5rem auto", fontSize: "18px", lineHeight: "1.8em" } },
      [
        createElement("h1", {}, "Feedify"),
        createElement("form", {}, [
          ...["url", "mainSelector", "itemSelector", "titleSelector", "dateSelector"].map(name =>
            createElement(
              "label",
              { htmlFor: name, style: { display: "flex", margin: "0.5rem", alignItems: "center" } },
              [
                createElement("span", { style: { width: "40%" } }, sentenceCase(name)),
                createElement("input", {
                  name,
                  value: query[name],
                  style: { width: "60%", fontSize: "18px" },
                }),
              ]
            )
          ),
          createElement("button", { type: "submit" }, "Submit"),

          createElement("h2", {}, title),
          createElement(
            "ul",
            {},
            items.map(item => createElement("li", { key: item.title }, item.title + " - " + item.date))
          ),
        ]),
      ]
    )
  );
}

module.exports = async function handler(req, res) {
  const { pathname, query } = url.parse(req.url, /* parseQueryString */ true);

  const errors = validate(query);
  let title;
  let items = [];
  let feed;

  if (!Object.keys(errors).length) {
    feed = await fetchFeed({ query });
    title = feed.title;
    items = feed.items;
  }


  switch (query.format) {
    case "json":
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return { title, url: query.url, items };

    case "rss":
    case "xml":
      res.setHeader("Content-Type", "application/atom+xml; charset=utf-8");
      return new rss(
        { title, url: query.url },
        items.map(item => ({ ...item, categories: [] }))
      ).xml();

    default:
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return ui({ query, title, items, res });
  }
};
