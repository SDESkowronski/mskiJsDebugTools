declare namespace Cypress {
  interface Chainable<Subject> {
    DumpHtmlOnDomChange(dump: boolean): void;
    WaitForStableDOM(): void;
    ConLog(funcName: string, message: string): void;

    WatchForWindowReload(): void;
    WaitForWindowLoadComplete(): void;
  }
}
