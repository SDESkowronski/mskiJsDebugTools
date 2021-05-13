import { conLog2 } from './logHelpers';

(function () {
  interface LogEntry {
    log: Cypress.Log;
    options: any;
  }

  let pendingEntries: LogEntry[] = [];

  // ---------------------------------------------------------------------------------
  // Overriding Cypress.log so that we can persist all of that data to a file as well.
  // ---------------------------------------------------------------------------------

  const originalCypressLog: (options: Partial<Cypress.LogConfig>) => Cypress.Log = Cypress.log;

  Cypress.log = function (options: Partial<Cypress.LogConfig>): Cypress.Log {
    // Reprocess the pending log entries. If they are still pending they
    // will not produce another persisted log entry AND they will also get
    // added back onto the new pending list.
    const oldPendingEntries = pendingEntries;
    pendingEntries = [];
    oldPendingEntries.forEach((pendingEntry) => {
      refineAndPersistLogEntry(pendingEntry.log, pendingEntry.options, true);
    });

    // Call the ORIGINAL Cypress.log function. It returns a Cypress.Log object that
    // contains the data we need to persist to a file.
    const log = originalCypressLog(options);

    refineAndPersistLogEntry(log, options, false);

    return log;
  };

  // Parse the data and persist as a log entry appropriate to the type of log data.
  function refineAndPersistLogEntry(log: Cypress.Log, options: any, retryPending: boolean) {
    if (!noName(log, options, retryPending) && !noMessage(log, options, retryPending) && !simple(log, options)) {
      maximumDump(log, options, retryPending);
    }
  }

  // Currently this is used for validation, we are NOT expecting any log entries
  // to have no 'name' property.
  function noName(log: Cypress.Log, options: any, retryPending: boolean): boolean {
    if (options.name !== undefined && options.name !== '') return false;

    // We are expecting everything to have a name property, since this one does not
    // we are dumping it to the log so we can investigate and update this code to
    // addapt to this type of log entry.
    debugLog('!!!!!!! - name IS UNDEFINED OR EMPTY!');
    maximumDump(log, options, retryPending);
    return true;
  }

  // For log entries without a 'message' property there are other ways to extract the
  // data we want to present.
  function noMessage(log: Cypress.Log, options: any, retryPending: boolean): boolean {
    if (options.message !== undefined && options.message !== '') return false;
    if (!route(options) && !requestAndXhr(log, options, retryPending) && !click(log, options)) {
      debugLog('Un-Handled UNDEFINED OR EMPTY message');
      maximumDump(log, options, retryPending);
    }
    return true;
  }

  // For simple log entries that have a message. So far we have found the message along
  // with a few other properties makes it a simple task of presenting this log entry.
  function simple(log: Cypress.Log, options: any): boolean {
    let message = `${options.name} - ${options.message}`;

    if (options.name === 'assert' && options.passed !== undefined)
      message += ` - ${options.passed ? 'passed' : 'failed'}`;

    if (options.url !== undefined && options.url !== '') message = message + ' - ' + options.url;

    persistLog(message);

    // To view more details for specific log entries replace this with the real name of the log entry.
    // if (options.name === '???')
    //   maximumDump(log, options, false);

    if (options.name === 'Finalize-Cypress.log') {
      // The previous test finished and a new test may be starting.
      if (pendingEntries.length === 0) persistLog('There are no pending requests.');
      else {
        // What happens here is at the last moment before a test ends, an initial request log entry
        // comes in, then the test ends before the request is resolved. Cypress is apparently clearing
        // them between tests so we need to do the same since we are tracking them.
        persistLog(`There are ${pendingEntries.length} pending requests that are unresolved...`);
        const finalRemainingPendingEntries = pendingEntries;
        pendingEntries = [];
        finalRemainingPendingEntries.forEach((pendingEntry) => {
          refineAndPersistLogEntry(pendingEntry.log, pendingEntry.options, false);
        });

        // We need to reset it again so the next test starts at zero pending entries.
        pendingEntries = [];
      }
    }

    return true;
  }

  // Present a 'route' log entry.
  function route(options: any): boolean {
    if (options.name !== 'route') return false;
    if (options.method === undefined) return false;
    if (options.url === undefined) return false;
    if (options.isStubbed === undefined) return false;

    persistLog(`Route: ${options.method} ${options.url} -- Is Stubbed: ${options.isStubbed}`);
    return true;
  }

  // Present a request...normal and XHR.
  function requestAndXhr(log: Cypress.Log, options: any, retryPending: boolean): boolean {
    if (options.name !== 'request' && options.name !== 'xhr') return false;

    // @ts-ignore
    const consoleProps = log.invoke('consoleProps');
    if (consoleProps === undefined) return false;

    if (options.renderProps === undefined || typeof options.renderProps !== 'function') return false;
    // @ts-ignore
    const renderProperties = log.invoke('renderProps');
    if (renderProperties === undefined || renderProperties.indicator === undefined) return false;

    let additionalData =
      objectPropertyToMultiLineString(consoleProps, 'Request') +
      objectPropertyToMultiLineString(consoleProps, 'Response') +
      objectPropertyToMultiLineString(consoleProps, 'Yielded');
    if (additionalData.length > 0) additionalData = '\n' + additionalData;

    if (renderProperties.indicator === 'pending') {
      pendingEntries.push({ log, options });
      if (retryPending) return true;
    }

    persistLog(
      `Request${options.name === 'xhr' ? ' (xhr)' : ''} ${renderProperties.message} - State: ${
        renderProperties.indicator
      }${additionalData}`
    );
    return true;
  }

  function click(log: Cypress.Log, options: any): boolean {
    if (options.name !== 'click' && options.$el === undefined) return false;

    persistLog(`${options.name}`);

    if (options.name !== 'click' && options.$el !== undefined) {
      debugLog(`Un-Handled "${options.name}" log element with a "$el" property`);
      maximumDump(log, options, false);
    }
    return true;
  }

  // This prevents the asserts and other identical messages being logged many times in a row.
  let lastLoggedMessage = '';
  let sameMessageCount = 0;
  function persistLog(message: string) {
    if (message === lastLoggedMessage) {
      sameMessageCount++;
      return;
    }

    if (sameMessageCount > 0) {
      conLog2('Cypress.log', `Previous Cypress.log message was repeated ${sameMessageCount} more times.`);
      sameMessageCount = 0;
    }

    conLog2('Cypress.log', message);
    lastLoggedMessage = message;
  }

  // This function is used to help with debugging this code file as opposed to debugging a test suite
  // or triaging an end product bug. It is very useful to understand the data Cypress sends to the log
  // function. The format variation is intended to make these entries stand out in the log file but
  // also not interfere with readability of the main data of interest for debugging a test suite.
  function debugLog(message: string) {
    conLog2('Cypress.log ---------------------------------------------------------', message);
  }

  // The purpose of this function is to present data that we are not formatting
  // in a refined way. We need it because:
  //   1) We are currently NOT refining every possible type of log entry.
  //   2) Changes could occur in how Cypress gives us the log entries.
  //   3) The data presented here is how I figured out how to refine each type of log entry.
  //
  // This gathers the maximum amount of data possible from the log and presents it in
  // a format that easily distinguishes it from more refined log presentations.
  //
  // retryPending = if true, no logging will happen if this is a pending log
  function maximumDump(log: Cypress.Log, options: any, retryPending: boolean) {
    // @ts-ignore
    const consoleProps = log.invoke('consoleProps');
    let renderProperties: any;
    let pending = false;

    if (options.renderProps !== undefined && typeof options.renderProps === 'function') {
      // @ts-ignore
      renderProperties = log.invoke('renderProps');
      pending = renderProperties !== undefined && renderProperties.indicator === 'pending';
    }

    if (!pending || !retryPending) {
      debugLog(`options - ${objectToString(options)}`);
      debugLog(`consoleProps - ${objectToString(consoleProps)}`);
      if (renderProperties !== undefined) debugLog(`renderProps - ${objectToString(renderProperties)}`);
    }

    if (pending) pendingEntries.push({ log, options });
  }

  function objectToString(object: object): string {
    let propertyList = '';
    const objectKeys = Object.keys(object);
    objectKeys.forEach((objectKey) => {
      propertyList += objectPropertyToSingleLineString(object, objectKey);
    });
    return propertyList;
  }

  function objectPropertyToSingleLineString(object: object, propertyName: string): string {
    return JSON.stringify(object);
    //return objectPropertyToFormattedString(object, propertyName, ', ', '');
  }

  function objectPropertyToMultiLineString(object: object, propertyName: string): string {
    return JSON.stringify(object, null, 2);
    //return objectPropertyToFormattedString(object, propertyName, '\n', '  ');
  }

  function objectPropertyToFormattedString(
    object: object,
    propertyName: string,
    separator: string,
    padding: string,
    indent = '',
    preventCircularList = '',
    depthCount = 0
  ): string {
    //return JSON.stringify(object, null, 2);
    try {
      if (depthCount >= 10) return '';

      // @ts-ignore
      const value = object[propertyName];
      if (value === undefined || value == null || value === '') return '';

      if (propertyName === 'Authorization') return `${indent}${propertyName}: ### hidden ###${separator}`;

      switch (typeof value) {
        case 'function':
          return `${indent}${propertyName}: {function}${separator}`;

        case 'object':
          const objectKeys = Object.keys(value);
          if (objectKeys.length > 30)
            return `${indent}${propertyName}: object has ${objectKeys.length} properties, too many to enumerate${separator}`;

          let retVal = '';
          objectKeys.forEach((objectKey) => {
            if (preventCircularList.includes(`"${objectKey}"`))
              retVal += `${indent + padding}${objectKey}: object${separator}`;
            else {
              const formattedString = objectPropertyToFormattedString(
                value,
                objectKey,
                separator,
                padding,
                indent + padding,
                preventCircularList + `"${objectKey}"`,
                depthCount + 1
              );
              if (formattedString.length > 2048) {
                retVal += `Truncated Subproperties to 2048 Characters ${formattedString.substring(0, 2048)}`;
                return;
              }
              retVal += formattedString;
            }
          });

          if (retVal.length > 0) retVal = `${indent}${propertyName}:${separator}` + retVal;
          return retVal;

        case 'string':
          if (value.length > 2048)
            return `${indent}${propertyName}: Length Was: ${
              value.length
            } Truncated to 2048 Characters - ${value.substring(0, 2048)}${separator}`;
          else return `${indent}${propertyName}: ${value}${separator}`;

        default:
          return `${indent}${propertyName}: ${value}${separator}`;
      }
    } catch (err) {
      conLog2(`objectPropertyToFormattedString`, `Caught Error: ${err.message}`);
      return '';
    }
  }

  function waitForNoPendingRequests() {
    let countStaysAtZero = 0;
    return cy.wrap('Waiting for Active Pending Requests to be 0', { timeout: 60000 }).should(() => {
      if (pendingEntries.length !== 0) countStaysAtZero = 0;
      assert.equal(`Pending Entries: 0`, `Pending Entries: ${pendingEntries.length}`);
      countStaysAtZero++;

      // For some reason this appeared to time out at less than 2 seconds. It needs further testing
      // and scrutiny. Without this line the 60 second time out held.
      assert.equal(5, countStaysAtZero);
    });
  }

  Cypress.Commands.add('waitForNoPendingRequests', () => {
    // Cannot use cy.log here since it causes run time error.
    Cypress.log({
      name: 'waitForNoPendingRequests',
      message: `Start - Active Pending Requests: ${pendingEntries.length}`,
    });

    return waitForNoPendingRequests();
  });
})();
