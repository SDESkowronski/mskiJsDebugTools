import { CyHttpMessages } from 'cypress/types/net-stubbing';

// This will cause ALL major API calls made by the application under test to be delayed by
// a specified milliseconds and/or have the response throttled to a specified kbps.
//
// delay is expressed in milliseconds
// throttle is expressed in kbps
//
// beforeEach('Simulate Slow Network Response Time', () => {simulateSlowNetworkResponseTime();});
//
export function simulateSlowNetworkResponseTime(delay: number = 5000, throttle: number = 0) {
  const delayFunction = (request: CyHttpMessages.IncomingHttpRequest) => {
    request.reply((response: CyHttpMessages.IncomingHttpResponse) => {
      if (delay) response.delay(delay);

      if (throttle) response.throttle(throttle);
    });
  };

  cy.intercept('GET', '**', delayFunction);
  cy.intercept('PUT', '**', delayFunction);
}
