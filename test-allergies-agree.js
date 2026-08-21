/* test-allergies-agree.js
 *
 * Run it:   node test-allergies-agree.js
 *
 * ONE PATIENT, ONE ANSWER ABOUT ALLERGIES, ON EVERY SCREEN.
 *
 * 5ec4177 made a named allergen beat the allergies_nka flag on the theatre
 * list, matching the clinical note and the theatre sheet. Three readers were
 * not updated and still preferred the flag, so a record holding "Penicillin"
 * AND a stale NKA tick — a state the plan's chip row lets you save — printed
 * the penicillin on the theatre list and "no known allergies" here. Fixing one
 * side and not the other is what created the disagreement; this test exists so
 * it cannot happen a third time.
 *
 * It reads THREE files in TWO repos and never copies any of them:
 *   patient-file/index.html            — the Copy-notes builder and srCase
 *   clinic-style/clinic-clinical-notes — allergyState, the canon
 *   clinic-style/clinic-preop-plan.js  — the theatre sheet + the letter's risks
 *
 * The patient file cannot import the canon: it loads the theatre sheet without
 * clinic-clinical-notes.js. So it carries a deliberate copy of the rule, and
 * this runs both over the same records and fails if they ever disagree.
 * (House rule 1. 22 August 2026.)
 */
"use strict";
const fs = require("fs");
const CS = "/Users/amyedwards/GitHub/clinic-style/";
const PF = fs.readFileSync(__dirname + "/index.html", "utf8");
const NOTES = fs.readFileSync(CS + "clinic-clinical-notes.js", "utf8");
const PLAN = fs.readFileSync(CS + "clinic-preop-plan.js", "utf8");

const g = (src, re, what) => { const m = src.match(re); if (!m) { console.error("FAIL: " + what + " not found"); process.exit(1); } return m[0]; };

// The canon, out of clinic-style.
const canon = new Function(
  g(NOTES, /const SAYS_NONE = \/\^[\s\S]*?\/i;/, "SAYS_NONE") + "\n" +
  g(NOTES, /function allergyState\(o\) \{[\s\S]*?\n  \}/, "allergyState (canon)") + "\nreturn allergyState;")();

// The patient file's own copy.
const pf = new Function(
  g(PF, /var PF_SAYS_NONE = \/\^[\s\S]*?\/i;/, "PF_SAYS_NONE") + "\n" +
  g(PF, /function allergyState\(o\) \{[\s\S]*?\n        \}/, "allergyState (patient file)") + "\nreturn allergyState;")();

// The two things this page actually prints.
const noteLine = new Function("allergyState", "o",
  g(PF, /var _al = allergyState\(o\);\n[\s\S]*?: "";\n/, "the Copy-notes allergy line") + "return allergy;").bind(null, pf);
const srRow = new Function("allergyState", "o",
  "return " + g(PF, /\(function \(\) \{          \/\/ named allergen beats the flag[\s\S]*?\n            \}\)\(\)/, "the srCase Allergies row") + ";").bind(null, pf);

// The theatre sheet / letter side.
const namesAnAllergen = new Function(
  g(PLAN, /const PLAN_SAYS_NONE = \/\^[\s\S]*?\/i;/, "PLAN_SAYS_NONE") + "\n" +
  g(PLAN, /function namesAnAllergen\(order\) \{[\s\S]*?\n  \}/, "namesAnAllergen") + "\nreturn namesAnAllergen;")();

let pass = 0, fail = 0;
const is = (l, got, want) => { const good = String(got) === String(want); good ? pass++ : fail++;
  console.log((good ? "  ok   " : "  FAIL ") + l + "   " + JSON.stringify(got) + (good ? "" : "   want " + JSON.stringify(want))); };

/* Every state a record can be in, including the ones only old rows reach. */
const CASES = [
  { allergies: "Penicillin", allergies_nka: true },   // THE BUG: both answers at once
  { allergies: "Penicillin", allergies_nka: false },
  { allergies: "Penicillin" },
  { allergies: ["Penicillin", "Latex"] },             // the array shape srCase already handled
  { allergies: "NKA", allergies_nka: true },
  { allergies: "nil known" },
  { allergies: "-", allergies_nka: true },
  { allergies: "none known" },
  { allergies_nka: true },
  { allergies_nka: false },                           // answered yes, nobody named it
  { allergies: "", allergies_nka: false },
  { allergies: "   " },
  { allergies: null, allergies_nka: null },
  {},
];

console.log("\nTHE BUG: a real allergy beside a stale NKA tick");
is("the patient file says there IS one", pf({ allergies: "Penicillin", allergies_nka: true }).state, "allergy");
is("Copy notes prints the allergen", noteLine({ allergies: "Penicillin", allergies_nka: true }), "Allergies: Penicillin\n");
is("the surgery panel prints it too", srRow({ allergies: "Penicillin", allergies_nka: true }), "Penicillin");
is("the theatre sheet agrees a name is there", namesAnAllergen({ allergies: "Penicillin", allergies_nka: true }), true);
is("and the letter's risks stay quiet about 'no known allergies'",
   /allergies_nka && !namesAnAllergen\(order\)\) risk\.push\("No known allergies"\)/.test(PLAN), true);

console.log("\nThe patient file and the clinical note agree on all " + CASES.length + " records");
CASES.forEach((o) => is("agree on " + JSON.stringify(o), pf(o).state, canon(o).state));

console.log("\nAnd a named allergen is a named allergen on both sides of the suite");
CASES.forEach((o) => is("plan agrees on " + JSON.stringify(o), namesAnAllergen(o.allergies && !Array.isArray(o.allergies) ? o : { allergies: Array.isArray(o.allergies) ? o.allergies.join(", ") : o.allergies }), canon({ allergies: Array.isArray(o.allergies) ? o.allergies.join(", ") : o.allergies }).state === "allergy"));

console.log("\nWhat each state actually prints");
is("none -> NKA",            noteLine({ allergies_nka: true }), "Allergies: NKA (no known allergies)\n");
is("none -> panel wording",  srRow({ allergies_nka: true }), "No known allergies");
is("unnamed -> ask",         noteLine({ allergies_nka: false }), "Allergies: Yes, and none is named on the record. Check with the patient.\n");
is("unnamed -> panel asks",  srRow({ allergies_nka: false }), "Yes, and none is named on the record. Check with the patient.");
is("nobody asked -> SILENCE", noteLine({}), "");
is("nobody asked -> row drops", srRow({}), "");
is("an array of allergens still reads", srRow({ allergies: ["Penicillin", "Latex"] }), "Penicillin, Latex");

console.log("\nThe flag is no longer read before the name, anywhere on this page");
const CODE = PF.replace(/\/\*[\s\S]*?\*\//g, "").replace(/([^:"'`])\/\/[^\n]*/g, "$1");
is("Copy notes no longer branches on the flag first",
   /o\.allergies_nka \? "Allergies: NKA/.test(CODE), false);
is("srCase no longer branches on the flag first",
   /o\.allergies_nka \? "No known allergies"/.test(CODE), false);
is("and the letter's risk line no longer takes the flag alone",
   /if \(order && order\.allergies_nka\) risk\.push/.test(PLAN.replace(/\/\*[\s\S]*?\*\//g, "")), false);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
