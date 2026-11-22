// Document-level checks: standards mode and language (FR-014), and no network use (FR-039).

export default [
  {
    name: "document",
    spec: "FR-014",
    async run(ctx) {
      const info = await ctx.eval(() => ({
        compatMode: document.compatMode,
        lang: document.documentElement.getAttribute("lang"),
        doctype: document.doctype ? document.doctype.name : null,
        description: document.querySelector('meta[name="description"]')?.getAttribute("content") || null,
      }));
      ctx.assert(info.doctype === "html", `Expected <!doctype html>, found ${info.doctype}`);
      ctx.assert(info.compatMode === "CSS1Compat", `Expected standards mode (CSS1Compat), got ${info.compatMode}`);
      ctx.assert(info.lang === "en", `Expected <html lang="en">, got ${JSON.stringify(info.lang)}`);
      ctx.assert(info.description, "Expected a <meta name=\"description\">");
    },
  },
  {
    name: "no-network",
    spec: "FR-039",
    async run(ctx) {
      await ctx.selectOpponent("random");
      await ctx.train(20);
      await ctx.sleep(300);
      const foreign = ctx.requests.filter((url) => url !== ctx.pageUrl);
      ctx.assert(
        foreign.length === 0,
        `The page made ${foreign.length} request(s) besides its own file: ${foreign.slice(0, 5).join(", ")}`,
      );
    },
  },
];
