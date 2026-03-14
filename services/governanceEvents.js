const EventEmitter = require("events");

class GovernanceEvents extends EventEmitter {}

const governanceEvents = new GovernanceEvents();

module.exports = governanceEvents;
