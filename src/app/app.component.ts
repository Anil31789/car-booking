import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MockDatabase } from '../core/services/mock-database';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
    }
  `]
})
export class AppComponent implements OnInit {
  title = 'carbooking-app';

  ngOnInit() {
    // Initialize mock database values
    MockDatabase.initialize();
  }
}
