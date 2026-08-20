// Reads the REAL patient-file index.html and exercises the edited code itself,
// so it cannot pass against logic that is no longer on the page.
const fs = require("fs");
const SRC = fs.readFileSync(__dirname + "/index.html", "utf8");

const grab = (re, what) => { const m = SRC.match(re); if (!m) { console.error("FAIL: " + what + " not found in the live file"); process.exit(1); } return m[0]; };
const whoSrc  = grab(/function whoBmiCategory\(v\) \{[\s\S]*?\n        \}/, "whoBmiCategory");
const calcSrc = grab(/function bmiFromHeightWeight\(h, w\) \{[\s\S]*?\n        \}/, "bmiFromHeightWeight");
const rendSrc = grab(/function renderBmiCategory\(\) \{[\s\S]*?\n        \}/, "renderBmiCategory");

// Stand-ins for the page's own helpers, so renderBmiCategory runs unmodified.
let BOX = "", OUT = "", state = { patient: {} };
const qs  = id => (id === "f-bmi-cat" ? { set textContent(v) { OUT = v; }, get textContent() { return OUT; } } : null);
const val = id => (id === "f-bmi" ? BOX : "");
// state is read as state.patient inside the function, so pass the object itself.
const renderWith = (box, patient) => { BOX = box; OUT = ""; 
  const f = new Function("qs","val","state", whoSrc+"\n"+calcSrc+"\n"+rendSrc+"\nreturn renderBmiCategory;")(qs, val, { patient });
  f(); return OUT; };

let pass = 0, fail = 0;
const is = (l, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++;
  console.log((ok ? "  ok   " : "  FAIL ") + l + "\n         got=" + JSON.stringify(got) + (ok ? "" : "\n        want=" + JSON.stringify(want))); };

console.log("\nBMI comes across from the surgery plan when nobody has typed one");
is("178 cm, 99 kg", renderWith("", { height_cm: 178, weight_kg: 99 }), "31.2 from the surgery plan (178 cm, 99 kg) — Obese class I");
is("160 cm, 55 kg", renderWith("", { height_cm: 160, weight_kg: 55 }), "21.5 from the surgery plan (160 cm, 55 kg) — Healthy");
is("strings from the database still work", renderWith("", { height_cm: "178", weight_kg: "99.0" }), "31.2 from the surgery plan (178 cm, 99.0 kg) — Obese class I");

console.log("\nNothing is invented");
is("no height or weight -> nothing", renderWith("", {}), "");
is("height only -> nothing",        renderWith("", { height_cm: 178 }), "");
is("weight only -> nothing",        renderWith("", { weight_kg: 99 }), "");
is("zero height -> nothing",        renderWith("", { height_cm: 0, weight_kg: 99 }), "");
is("nonsense -> nothing",           renderWith("", { height_cm: "n/a", weight_kg: "?" }), "");

console.log("\nA stored BMI cannot follow a corrected weight, so a disagreement is SHOWN, never hidden");
is("typed 28 vs the plan's 31.2 -- both said, neither buried",
   renderWith("28", { height_cm: 178, weight_kg: 99 }),
   "Typed 28 \u2014 Overweight. The plan's height and weight give 31.2 (178 cm, 99 kg) \u2014 Obese class I. Check which is right.");
is("weight corrected to 78 -> the calculated one follows it",
   renderWith("28", { height_cm: 178, weight_kg: 78 }),
   "Typed 28 \u2014 Overweight. The plan's height and weight give 24.6 (178 cm, 78 kg) \u2014 Healthy. Check which is right.");
is("they agree -> just the category, no noise", renderWith("31.2", { height_cm: 178, weight_kg: 99 }), "Obese class I");
is("agree within a rounding hair -> still no noise", renderWith("31.25", { height_cm: 178, weight_kg: 99 }), "Obese class I");
is("typed with no height or weight to check against", renderWith("28", {}), "Overweight");
is("typed nonsense still says so", renderWith("abc", { height_cm: 178, weight_kg: 99 }), "Not a usable BMI");

console.log("\nThe pre-screening box is gone, and so is every way to write it");
const noBox   = !/id="f-prescreening_date"/.test(SRC);
const noRead  = !/val\("f-prescreening_date"\)/.test(SRC);
const noPatch = !/patch\.prescreening_date\s*=/.test(SRC);
const noSetV  = !/setVal\("f-prescreening_date"/.test(SRC);
is("the box is off the page", noBox, true);
is("nothing reads the box",   noRead, true);
is("nothing writes the column from this screen", noPatch, true);
is("nothing tries to fill the box", noSetV, true);
is("the BMI box survives", /id="f-bmi"/.test(SRC), true);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
