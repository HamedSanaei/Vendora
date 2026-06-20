import { makeAutoObservable } from 'mobx';

export class AdminUiStore {
  isSidebarOpen = false;

  constructor() {
    makeAutoObservable(this);
  }

  /** Toggles the mobile sidebar drawer. */
  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  /** Closes the mobile sidebar drawer. */
  closeSidebar(): void {
    this.isSidebarOpen = false;
  }
}
