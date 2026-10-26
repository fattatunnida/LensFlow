const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onCall } = require('firebase-functions/v2/https');
const service = require('./service.cjs');
const finance = require('./finance.cjs');
const overview = require('./overview.cjs');
const management = require('./management.cjs');
const reports = require('./reports.cjs');
const { onSchedule } = require('firebase-functions/v2/scheduler');
initializeApp();
const options = { region: 'asia-southeast2', memory: '256MiB', timeoutSeconds: 30, maxInstances: 5 };
for (const [name, handler] of Object.entries({ bookingCommand: service.command, bookingChoices: service.choices, bookingAvailability: service.availability, financeCommand: finance.command, financeBookings: finance.bookings, financeSources: finance.sources, dashboardRead:overview.dashboard, inboxList:overview.list, inboxRead:overview.mark, inboxPreferences:overview.preferences, reportsRead:reports.read, studioSettings:management.studio, profileSettings:management.profile, staffList:management.staff, staffCommand:management.staffCommand })) {
  exports[name] = onCall(options, (request) => handler(getFirestore(),request.auth?.uid,request.data));
}
exports.staffAccept = onCall(options, request => management.accept(getFirestore(), request));
exports.inboxScheduler=onSchedule({schedule:'every 15 minutes',timeZone:'Asia/Jakarta',region:'asia-southeast2',timeoutSeconds:540,maxInstances:1},()=>overview.dispatch(getFirestore()));
