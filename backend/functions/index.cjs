const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onCall } = require('firebase-functions/v2/https');
const service = require('./service.cjs');
const finance = require('./finance.cjs');
initializeApp();
const options = { region: 'asia-southeast2', memory: '256MiB', timeoutSeconds: 30, maxInstances: 5 };
for (const [name, handler] of Object.entries({ bookingCommand: service.command, bookingChoices: service.choices, bookingAvailability: service.availability, financeCommand: finance.command, financeBookings: finance.bookings, financeSources: finance.sources })) {
  exports[name] = onCall(options, (request) => handler(getFirestore(),request.auth?.uid,request.data));
}
