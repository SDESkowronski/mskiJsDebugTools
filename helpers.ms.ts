/**
 * Some of this code came from Conversation Learner,
 * an Open Source Microsoft project.
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

// Return a random integer between 0 and max - 1.
export function getRandomInt(max: number) {
  return Math.floor(Math.random() * Math.floor(max));
}

// NOTE: the '-+-' is a signature for filtering console output
export function ConLog(funcName: string, message: string): void {
  console.log(`-+- ${Cypress.moment().format('HH:mm:ss..SSS')} - ${funcName} - ${message}`);
}

export function DumpObject(funcName: string, object: object): void {
  let propertyList = '';
  for (let property in object)
    propertyList += `${propertyList.length == 0 ? '' : ', '}${property}: ${object[property]}`;
  ConLog(funcName, propertyList);
}

export function NumberToStringWithLeadingZeros(number: number, length: number): string {
  let string = String(number);
  if (string.length < length) {
    string = '0'.repeat(length - string.length) + string;
  }
  return string;
}

export function DumpElements(funcName: string, elements: any): void {
  let elementList = `Dump of ${elements.length} elements:\n`;
  for (let i = 0; i < elements.length; i++) {
    elementList += `${NumberToStringWithLeadingZeros(i, 3)}: ${elements[i].outerHTML.replace(/\n/g, '\n     ')}\n`;
  }
  ConLog(funcName, elementList);
}

export function RemoveDuplicates(inputArray: any[]): any[] {
  let uniqueOutputArray = [];
  for (let i = 0; i < inputArray.length; i++)
    if (uniqueOutputArray.indexOf(inputArray[i]) == -1) uniqueOutputArray.push(inputArray[i]);

  return uniqueOutputArray;
}

export function StringArrayFromElementText(selector: string, retainMarkup = false): string[] {
  let funcName = `StringArrayFromElementText(${selector})`;
  let elements = Cypress.$(selector);
  ConLog(funcName, `Number of Elements Found: ${elements.length}`);
  let returnValues = [];
  for (let i = 0; i < elements.length; i++) {
    let text = retainMarkup ? elements[i].innerHTML : TextContentWithoutNewlines(elements[i]);
    returnValues.push(text);
    ConLog(funcName, `"${text}"`);
  }
  return returnValues;
}

export function NumericArrayFromElementText(selector: string): number[] {
  let elements = Cypress.$(selector);
  let returnValues = [];
  for (let i = 0; i < elements.length; i++) {
    returnValues.push(parseInt(TextContentWithoutNewlines(elements[i])));
  }
  return returnValues;
}

// This will return only the printable Inner Text of an element without markup nor newline characters.
// Needed because each browser handles this functionality differently.
// This trims the string and...
// ...also converts the ‘ and ’ to a ' and...
// ...also converts the “ and ” to a " and...
// ...also keeps the '◾️' and '…' charcters and throws away anything else outside of the typical printable set.
export function TextContentWithoutNewlines(element: any): string {
  if (element === undefined) {
    ConLog('TextContentWithoutNewlines', 'undefined element has been passed in.');
    return '';
  }

  const textContent = element.textContent;
  ConLog('TextContentWithoutNewlines', `Raw Text Content: "${textContent}"`);

  if (!textContent) {
    ConLog(
      'TextContentWithoutNewlines',
      `textContent is undefined, which typically means there is no text. Here is the element that was passed in: ${element.outerHTML}`
    );
    return '';
  }

  // See the Cheat Sheet on https://www.regextester.com/15 for help with this 'NOT ^' regex string
  const returnValue = textContent
    .trim()
    .replace(/‘|’/g, "'")
    .replace(/“|”/g, '"')
    .replace(/([^◾️…\x20-\x7E])/gm, '');
  ConLog('TextContentWithoutNewlines', `"${returnValue}"`);
  return returnValue;
}

// This will return an array of the Inner Text (with New Lines removed) of an array of elements.
// Pass in either an array of elements or the selector to get the array of elements with.
export function ArrayOfTextContentWithoutNewlines(elementsOrSelector: any): string[] {
  if (elementsOrSelector === undefined || elementsOrSelector.length == 0) {
    return [];
  }

  let elements;
  if (typeof elementsOrSelector == 'string') {
    elements = Cypress.$(elementsOrSelector);
  } else {
    elements = elementsOrSelector;
  }

  let arrayOfTextContent = [];
  for (let i = 0; i < elements.length; i++) {
    arrayOfTextContent.push(TextContentWithoutNewlines(elements[i]));
  }
  return arrayOfTextContent;
}

// This behaves slightly different than the cy.contains command does in that the elements returned
// can contain multiple parent elements as well compared to the cy.contains command. To zoom in
// to a smaller set of elements you can sometimes get away with calling it like this:
//    cy.contains('your search string').ExactMatch('your search string')
export function ExactMatch(elements: any[], expectedText: string): any[] {
  const funcName = `ExactMatch('${expectedText}')`;
  ConLog(funcName, `Start`);

  for (let i = 0; i < elements.length; i++) {
    const elementText = TextContentWithoutNewlines(elements[i]);
    ConLog(funcName, `elementText: '${elementText}'`);
    if (elementText === expectedText) return [elements[i]];
  }
  return [];
}

export function ExactMatches(elements: any[], expectedText: string): any[] {
  const funcName = `ExactMatches('${expectedText}')`;
  ConLog(funcName, `Start`);
  let returnElements = [];
  for (let i = 0; i < elements.length; i++) {
    const elementText = TextContentWithoutNewlines(elements[i]);
    ConLog(funcName, `elementText: '${elementText}'`);
    if (elementText === expectedText) returnElements.push(elements[i]);
  }
  return returnElements;
}

export function verifyAttributeTrue(selector: string, attrName: string, errorMessage: string): void {
  cy.get(selector).then((elements) => {
    // Not using this .should('not.have.attr', attrName, 'true')
    // because it does not fail fast, takes 4 seconds to realize its never gonna show up.
    assert.equal(elements.length, 1, 'Expecting Only 1 element');
    let attr: string | undefined = Cypress.$(elements[0]).attr(attrName);
    ConLog(
      'verifyAttributeTrue',
      `Attribute ${attrName}: ${attr} - Selector: ${selector} - Element HTML: ${elements[0].outerHTML}`
    );
    if (attr == undefined || (attr != 'true' && attr != attrName)) throw new Error(errorMessage);
  });
}

export function verifyAttributeFalse(selector: string, attrName: string, errorMessage: string): void {
  cy.get(selector).then((elements) => {
    // Not using this .should('not.have.attr', attrName, 'true')
    // because it does not fail fast, takes 4 seconds to realize its never gonna show up.
    assert.equal(elements.length, 1, 'Expecting Only 1 element');
    let attr: string | undefined = Cypress.$(elements[0]).attr(attrName);
    ConLog(
      'verifyAttributeFalse',
      `Attribute ${attrName}: ${attr} - Selector: ${selector} - Element HTML: ${elements[0].outerHTML}`
    );
    if (attr != undefined && !(attr != 'true' && attr != attrName)) throw new Error(errorMessage);
  });
}

export function verifyAttribute(state: Boolean, selector: string, attrName: string, errorMessage: string): void {
  cy.get(selector).then((elements) => {
    // Not using ".should('not.have.attr', attrName, state)" because it
    // does not fail fast, it takes 4 seconds to realize its never gonna show up.
    assert.equal(elements.length, 1, 'Expecting Only 1 element');
    let attr: string | undefined = Cypress.$(elements[0]).attr(attrName);
    ConLog(
      `verifyAttribute is ${state}`,
      `Attribute ${attrName}: ${attr} - Selector: ${selector} - Element HTML: ${elements[0].outerHTML}`
    );

    let attrState = attr != undefined && !(attr != 'true' && attr != attrName);
    if (attrState != state) throw new Error(errorMessage);
  });
}
