import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CITIES_DATA, City } from '../../core/data/cities.data';

export type { City } from '../../core/data/cities.data';

@Component({
  selector: 'app-location-autocomplete',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="custom-input-group" (click)="$event.stopPropagation()">
      <label *ngIf="label">{{ label }}</label>
      <div class="input-wrapper">
        <span class="material-icons-outlined prefix-icon" [class]="iconClass">{{ icon }}</span>

        <input
          type="text"
          [placeholder]="placeholder"
          [(ngModel)]="inputValue"
          (ngModelChange)="onInputChange($event)"
          (focus)="onInputFocus()"
          (blur)="onInputBlur()"
          (keydown)="onKeyDown($event)"
          [disabled]="disabled"
          required
          class="search-input"
          autocomplete="off" />
      </div>

      <!-- Autocomplete Dropdown List -->
      <div class="autocomplete-dropdown glass-panel" *ngIf="showDropdown && filteredCities.length > 0">
        <div
          *ngFor="let city of filteredCities; let i = index"
          class="dropdown-item"
          [class.active]="i === activeIndex"
          (mouseenter)="activeIndex = i"
          (mousedown)="$event.preventDefault(); selectCity(city)">
          <span class="material-icons-outlined location-pin-icon">location_on</span>
          <div class="city-meta">
            <span class="city-name">{{ city.name }}</span>
            <span class="state-name">{{ city.state }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .custom-input-group {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
    }

    label {
      font-size: 0.72rem;
      font-weight: 700;
      color: hsl(var(--text-tertiary));
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }

    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      border: 1px solid hsl(var(--border-light));
      border-radius: var(--border-radius-sm);
      padding: 10px 14px;
      background-color: hsl(var(--bg-primary));
      transition: var(--transition-smooth);

      &:focus-within {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.15);
      }
    }

    .search-input {
      border: none;
      background: none;
      outline: none;
      font-size: 0.95rem;
      font-weight: 600;
      color: hsl(var(--text-primary));
      padding: 0;
      width: 100%;
      height: 22px;

      &::placeholder {
        color: hsl(var(--text-tertiary));
        font-weight: 500;
      }
    }

    .prefix-icon {
      font-size: 20px;
      color: hsl(var(--text-tertiary));
      margin-right: 10px;

      &.text-primary {
        color: var(--color-primary);
      }

      &.text-secondary {
        color: var(--color-secondary);
      }
    }

    /* Dropdown suggestions container */
    .autocomplete-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      max-height: 200px;
      overflow-y: auto;
      border-radius: var(--border-radius-sm);
      border: 1px solid hsl(var(--border-light));
      z-index: 1000;
      display: flex;
      flex-direction: column;
      padding: 6px 0 !important; /* Overriding global glass-panel padding */
      box-shadow: var(--shadow-lg);
      background-color: hsl(var(--bg-primary));
      animation: dropdownFade 0.2s ease-out forwards;
    }

    @keyframes dropdownFade {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      cursor: pointer;
      transition: var(--transition-smooth);

      &.active {
        background-color: hsl(var(--bg-secondary));
        .location-pin-icon {
          color: var(--color-primary);
        }
      }
    }

    .location-pin-icon {
      font-size: 18px;
      color: hsl(var(--text-tertiary));
      transition: var(--transition-smooth);
    }

    .city-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .city-name {
      font-size: 0.88rem;
      font-weight: 700;
      color: hsl(var(--text-primary));
    }

    .state-name {
      font-size: 0.72rem;
      color: hsl(var(--text-secondary));
    }
  `]
})
export class LocationAutocompleteComponent implements OnInit, OnChanges {
  @Input() label = '';
  @Input() placeholder = 'Search location...';
  @Input() value = '';
  @Input() icon = 'place';
  @Input() iconClass = '';
  @Input() disabled = false;

  @Output() valueChange = new EventEmitter<string>();

  inputValue = '';
  showDropdown = false;
  filteredCities: City[] = [];
  activeIndex = -1;

  // Reusable local Indian cities dataset
  private citiesList: City[] = CITIES_DATA;

  private elementRef = inject(ElementRef);

  ngOnInit() {
    this.inputValue = this.value;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value']) {
      this.inputValue = changes['value'].currentValue || '';
    }
  }

  onInputChange(val: string) {
    this.inputValue = val;
    this.valueChange.emit(val);
    this.filterLocations();
  }

  filterLocations() {
    const query = this.inputValue.toLowerCase().trim();
    if (!query) {
      // If blank but focused, show popular selections
      this.filteredCities = this.citiesList.slice(0, 6);
      this.activeIndex = -1;
      return;
    }

    this.filteredCities = this.citiesList.filter(city =>
      city.name.toLowerCase().includes(query) ||
      city.state.toLowerCase().includes(query)
    );
    this.activeIndex = -1; // Reset active item selection
  }

  onInputFocus() {
    if (this.disabled) return;
    this.showDropdown = true;
    this.filterLocations();
  }

  onInputBlur() {
    // Timeout handles keyboard/mouse actions registers
    setTimeout(() => {
      this.showDropdown = false;
    }, 150);
  }

  selectCity(city: City) {
    this.inputValue = city.name;
    this.valueChange.emit(city.name);
    this.showDropdown = false;
    this.activeIndex = -1;
  }

  // Keyboard Navigation Handling
  onKeyDown(event: KeyboardEvent) {
    if (this.disabled) return;
    if (!this.showDropdown) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        this.showDropdown = true;
        this.filterLocations();
        event.preventDefault();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (this.filteredCities.length > 0) {
          this.activeIndex = (this.activeIndex + 1) % this.filteredCities.length;
          this.scrollActiveIntoView();
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (this.filteredCities.length > 0) {
          this.activeIndex = this.activeIndex <= 0 ? this.filteredCities.length - 1 : this.activeIndex - 1;
          this.scrollActiveIntoView();
        }
        break;

      case 'Enter':
        event.preventDefault();
        if (this.activeIndex >= 0 && this.activeIndex < this.filteredCities.length) {
          this.selectCity(this.filteredCities[this.activeIndex]);
          // Blur the input to hide focus state
          (event.target as HTMLElement).blur();
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.showDropdown = false;
        this.activeIndex = -1;
        break;
    }
  }

  // Helper method to scroll elements in dropdown container
  private scrollActiveIntoView() {
    setTimeout(() => {
      const dropdown = this.elementRef.nativeElement.querySelector('.autocomplete-dropdown');
      const activeItem = dropdown?.querySelector('.dropdown-item.active');
      if (dropdown && activeItem) {
        const dropdownHeight = dropdown.clientHeight;
        const itemTop = activeItem.offsetTop;
        const itemHeight = activeItem.clientHeight;

        if (itemTop + itemHeight > dropdown.scrollTop + dropdownHeight) {
          dropdown.scrollTop = itemTop + itemHeight - dropdownHeight;
        } else if (itemTop < dropdown.scrollTop) {
          dropdown.scrollTop = itemTop;
        }
      }
    }, 0);
  }

  // Close suggestions if clicked outside the component bounds
  @HostListener('document:click', ['$event'])
  clickOutside(event: Event) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showDropdown = false;
    }
  }
}
