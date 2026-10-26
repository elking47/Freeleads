import { createApp } from "./app.js";
import { purgeExpiredSessions } from "./auth.js";
import { config } from "./config.js";
import { runDailyCycle } from "./engine/pipeline.js";
import { seedTemplates } from "./seed-templates.js";

seedTemplates();

// Runs tonight's batch once it is due and delivers it to every account (idempotent per day).
function cycle() {
  try {
    const { batchDate, delivered } = runDailyCycle();
    if (delivered) console.log(`[engine] batch ${batchDate}: delivered ${delivered} Freeleads`);
    purgeExpiredSessions();
  } catch (error) {
    console.error("[engine] daily cycle failed", error);
  }
}
cycle();
setInterval(cycle, 5 * 60_000);

createApp().listen(config.port, config.host, () => {
  console.log(`Freeleads running on http://${config.host}:${config.port}`);
});
