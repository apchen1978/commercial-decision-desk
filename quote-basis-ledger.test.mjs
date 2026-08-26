// quote-basis-ledger.test.mjs — tests for the Quote Basis Ledger.
// Node-only; independent from verify.mjs (untouched).
import { normalizeQuote, compareQuotes, quoteLedger, INCOTERM_RESPONSIBILITY } from "./quote-basis-ledger.js";

const results = [];
const check = (name, cond, detail = "") => {
  results.push([name, !!cond]);
  console.log((cond ? "PASS " : "FAIL ") + name + (cond ? "" : "  | " + detail));
};

// 1. normalization
{
  const q = normalizeQuote({ label: "A 供應商", incoterm: "fob", currency: "usd", amount: "480000", validUntil: "2026-09-30" });
  check("incoterm upper-cased", q.incoterm === "FOB", q.incoterm);
  check("currency upper-cased", q.currency === "USD", q.currency);
  check("amount parsed to number", q.amount === 480000, String(q.amount));
  check("FOB responsibility map present", !!q.responsibility && q.responsibility.freight === "BUYER");
  const blank = normalizeQuote({});
  check("blank quote -> UNKNOWN basis", blank.basis === "UNKNOWN");
  check("blank quote -> UNKNOWN incoterm", blank.incoterm === "UNKNOWN");
  check("blank quote -> null amount", blank.amount === null);
  check("UNKNOWN currency stays UNKNOWN (not invented)", blank.currency === "UNKNOWN");
}

// 2. comparability — same basis + same currency
{
  const same = quoteLedger({ quotes: [
    { label: "A", incoterm: "FOB", currency: "USD", amount: 100 },
    { label: "B", incoterm: "FOB", currency: "USD", amount: 95 },
  ]});
  check("same basis+currency -> comparable", same.comparable === true, String(same.comparable));
  check("comparable -> sorted view available", Array.isArray(same.sorted) && same.sorted.length === 2);
  check("sorted ascending (A=100 after B=95)", same.sorted[0].label === "B" && same.sorted[1].label === "A");
  check("comparable -> notRanked false", same.notRanked === false);
}

// 3. Rule 4 — mixed bases never ranked
{
  const mixed = quoteLedger({ quotes: [
    { label: "A", incoterm: "FOB", currency: "USD", amount: 100 },
    { label: "B", incoterm: "DDP", currency: "USD", amount: 120 },
  ]});
  check("mixed bases -> NOT comparable", mixed.comparable === false);
  check("mixed bases -> notRanked true", mixed.notRanked === true);
  check("mixed bases -> sorted null (never ranked)", mixed.sorted === null);
  check("reason MIXED_BASES recorded", mixed.reasons.includes("MIXED_BASES"));
  check("distinct bases listed [FOB,DDP]", mixed.distinctBases.includes("FOB") && mixed.distinctBases.includes("DDP"));
}

// 4. mixed currency also blocks comparability (no silent FX)
{
  const fx = quoteLedger({ quotes: [
    { label: "A", incoterm: "FOB", currency: "USD", amount: 100 },
    { label: "B", incoterm: "FOB", currency: "EUR", amount: 95 },
  ]});
  check("mixed currency -> NOT comparable", fx.comparable === false);
  check("reason MIXED_CURRENCIES recorded", fx.reasons.includes("MIXED_CURRENCIES"));
}

// 5. incomplete entries block comparability without inventing
{
  const inc = quoteLedger({ quotes: [
    { label: "A", incoterm: "FOB", currency: "USD", amount: 100 },
    { label: "B", incoterm: "FOB", currency: "USD" }, // no amount
  ]});
  check("missing amount -> NOT comparable", inc.comparable === false);
  check("reason INCOMPLETE_ENTRIES recorded", inc.reasons.includes("INCOMPLETE_ENTRIES"));
  const noQuotes = quoteLedger({ quotes: [] });
  check("empty set -> not comparable", noQuotes.comparable === false);
  check("empty set -> reason NO_QUOTES", noQuotes.reasons.includes("NO_QUOTES"));
}

// 6. responsibility map sanity (presentation aid, not legal advice)
{
  check("EXW: buyer bears everything", INCOTERM_RESPONSIBILITY.EXW.freight === "BUYER" && INCOTERM_RESPONSIBILITY.EXW.duties === "BUYER");
  check("CIF: seller bears freight+insurance", INCOTERM_RESPONSIBILITY.CIF.freight === "SELLER" && INCOTERM_RESPONSIBILITY.CIF.insurance === "SELLER");
  check("DDP: seller bears duties too", INCOTERM_RESPONSIBILITY.DDP.duties === "SELLER");
  check("unknown incoterm -> no responsibility map (never guessed)", normalizeQuote({ incoterm: "XXX" }).responsibility === null);
}

// 7. determinism
{
  const a = quoteLedger({ quotes: [{ label: "A", incoterm: "FOB", currency: "USD", amount: 100 }] });
  const b = quoteLedger({ quotes: [{ label: "A", incoterm: "FOB", currency: "USD", amount: 100 }] });
  check("deterministic (two runs identical)", JSON.stringify(a) === JSON.stringify(b));
}

const failed = results.filter(([, ok]) => !ok);
console.log(`\nQUOTE BASIS LEDGER RESULT: ${results.length - failed.length}/${results.length} PASS`);
process.exitCode = failed.length ? 1 : 0;
