import RFB from "../../node_modules/@novnc/novnc/core/rfb.js";

window.NoVncRfb = RFB;
window.dispatchEvent(new Event("cybergrid:novnc-ready"));
