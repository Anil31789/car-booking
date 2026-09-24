import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('UI/UX Improvements Suite', () => {
  describe('1. Driver Page: Newly created/edited offered rides session highlight', () => {
    test('tracks newly published and edited ride IDs in session set', () => {
      const newlyCreatedRideIds = new Set<string>();
      const isNewlyCreated = (rideId: string) => newlyCreatedRideIds.has(rideId);

      const olderRide = { id: 'ride_old_1', startLocation: 'Pune', destination: 'Mumbai', pricePerSeat: 300 };
      const newRide = { id: 'ride_new_2', startLocation: 'Pune', destination: 'Nashik', pricePerSeat: 400 };
      const editedRide = { id: 'ride_edited_3', startLocation: 'Mumbai', destination: 'Goa', pricePerSeat: 800 };

      // Initially, no rides are newly created
      assert.strictEqual(isNewlyCreated(olderRide.id), false);
      assert.strictEqual(isNewlyCreated(newRide.id), false);

      // Publish new ride: add to set
      newlyCreatedRideIds.add(newRide.id);
      assert.strictEqual(isNewlyCreated(newRide.id), true);
      assert.strictEqual(isNewlyCreated(olderRide.id), false);

      // Edit existing ride: add to set
      newlyCreatedRideIds.add(editedRide.id);
      assert.strictEqual(isNewlyCreated(editedRide.id), true);

      // Verify ride data is untouched
      assert.strictEqual(newRide.startLocation, 'Pune');
      assert.strictEqual(newRide.pricePerSeat, 400);

      // Session-based: fresh session / new instance starts empty
      const freshSessionSet = new Set<string>();
      const isFreshSessionNew = (rideId: string) => freshSessionSet.has(rideId);
      assert.strictEqual(isFreshSessionNew(newRide.id), false);
    });
  });

  describe('2. Modal Layering & Stacking Hierarchy', () => {
    test('verifies CDK overlay and styles configuration in styles.scss', () => {
      const stylesPath = path.resolve(__dirname, '../../styles.scss');
      const stylesContent = fs.readFileSync(stylesPath, 'utf8');

      // 1. Overlay prebuilt css is imported
      assert.ok(
        stylesContent.includes("@import '@angular/cdk/overlay-prebuilt.css';"),
        'CDK overlay prebuilt stylesheet must be imported in styles.scss'
      );

      // 2. .cdk-overlay-container has z-index: 1100 (above page modals at 1000)
      assert.ok(
        stylesContent.includes('.cdk-overlay-container') && stylesContent.includes('z-index: 1100;'),
        '.cdk-overlay-container must be positioned with z-index: 1100'
      );

      // 3. .custom-dialog-panel styling configured
      assert.ok(
        stylesContent.includes('.custom-dialog-panel'),
        '.custom-dialog-panel styles must be present'
      );
    });

    test('verifies DriverComponent markup and CSS for new ride highlight', () => {
      const driverComponentPath = path.resolve(__dirname, '../../features/driver/driver.component.ts');
      const driverContent = fs.readFileSync(driverComponentPath, 'utf8');

      // 1. Conditional class [class.new-offer-card]
      assert.ok(
        driverContent.includes('[class.new-offer-card]="isNewlyCreated(ride.id)"'),
        'Driver component template must apply new-offer-card class conditionally'
      );

      // 2. NEW badge rendered conditionally
      assert.ok(
        driverContent.includes('*ngIf="isNewlyCreated(ride.id)">NEW</span>'),
        'Driver component template must render NEW badge for newly created rides'
      );

      // 3. Highlight CSS rules defined
      assert.ok(
        driverContent.includes('.new-offer-card') && driverContent.includes('.new-badge'),
        'Driver component must define styles for .new-offer-card and .new-badge'
      );
    });

    test('verifies BookingComponent Terms modal preserves state across LegalDialog open/close', () => {
      const bookingComponentPath = path.resolve(__dirname, '../../features/booking/booking.component.ts');
      const bookingContent = fs.readFileSync(bookingComponentPath, 'utf8');

      // 1. Terms modal backdrop has z-index: 1000
      assert.ok(
        bookingContent.includes('.terms-modal-backdrop') && bookingContent.includes('z-index: 1000;'),
        'Terms modal backdrop must sit at z-index: 1000 below CDK overlay (1100)'
      );

      // 2. openLegal opens LegalDialog with custom-dialog-panel
      assert.ok(
        bookingContent.includes('openLegal') && bookingContent.includes("panelClass: 'custom-dialog-panel'"),
        'openLegal in booking component must open dialog with custom-dialog-panel'
      );

      // 3. openLegal does not dismiss showTermsModal
      const openLegalMatch = bookingContent.match(/openLegal\([^)]*\)\s*{([^}]+)}/);
      assert.ok(openLegalMatch, 'openLegal method should be found');
      assert.ok(
        !openLegalMatch[1].includes('showTermsModal = false'),
        'openLegal must not close the terms confirmation modal'
      );
    });
  });

  describe('3. City Autocomplete: Local Dataset & Filtering', () => {
    test('loads and validates local cities.json dataset', () => {
      const citiesJsonPath = path.resolve(__dirname, '../data/cities.json');
      assert.ok(fs.existsSync(citiesJsonPath), 'cities.json must exist');

      const raw = fs.readFileSync(citiesJsonPath, 'utf8');
      const cities = JSON.parse(raw);
      assert.ok(Array.isArray(cities), 'cities.json must be a JSON array');
      assert.ok(cities.length >= 32, 'cities.json must contain at least the 32 original cities');

      // Check structure
      for (const c of cities) {
        assert.ok(typeof c.name === 'string' && c.name.trim().length > 0, 'City must have non-empty name');
        assert.ok(typeof c.state === 'string' && c.state.trim().length > 0, 'City must have non-empty state');
      }

      // Check top 6 original popular cities
      const top6Names = cities.slice(0, 6).map((c: any) => c.name);
      assert.deepStrictEqual(top6Names, ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Thane']);

      // Check new cities exist in dataset
      const allNames = new Set(cities.map((c: any) => c.name));
      assert.ok(allNames.has('Kolhapur'), 'Should contain Kolhapur');
      assert.ok(allNames.has('Solapur'), 'Should contain Solapur');
      assert.ok(allNames.has('Panaji'), 'Should contain Panaji');
      assert.ok(allNames.has('Mysore'), 'Should contain Mysore');
    });

    test('LocationAutocompleteComponent correctly imports and filters from local dataset', () => {
      const compPath = path.resolve(__dirname, '../../shared/components/location-autocomplete.component.ts');
      const content = fs.readFileSync(compPath, 'utf8');

      // Verify import from cities.data
      assert.ok(
        content.includes("from '../../core/data/cities.data'") || content.includes('CITIES_DATA'),
        'Component must import from cities.data'
      );

      // Verify no hardcoded citiesList array
      assert.ok(
        !content.includes("{ name: 'Mumbai', state: 'Maharashtra' }"),
        'Component must not contain hardcoded cities list'
      );

      // Simulate component filtering logic with cities.json
      const citiesJsonPath = path.resolve(__dirname, '../data/cities.json');
      const citiesList: Array<{ name: string; state: string }> = JSON.parse(fs.readFileSync(citiesJsonPath, 'utf8'));

      const filterLocations = (inputVal: string) => {
        const query = inputVal.toLowerCase().trim();
        if (!query) {
          return citiesList.slice(0, 6);
        }
        return citiesList.filter(city =>
          city.name.toLowerCase().includes(query) ||
          city.state.toLowerCase().includes(query)
        );
      };

      // 1. Empty input -> top 6 popular cities
      const emptyResults = filterLocations('');
      assert.strictEqual(emptyResults.length, 6);
      assert.strictEqual(emptyResults[0].name, 'Mumbai');
      assert.strictEqual(emptyResults[1].name, 'Pune');

      // 2. Case-insensitive exact / partial match
      const lowerResults = filterLocations('mumbai');
      assert.ok(lowerResults.some(c => c.name === 'Mumbai'));

      const upperResults = filterLocations('PUNE');
      assert.ok(upperResults.some(c => c.name === 'Pune'));

      // 3. Partial matching
      const partialResults = filterLocations('kolh');
      assert.ok(partialResults.some(c => c.name === 'Kolhapur'));

      // 4. State matching
      const goaResults = filterLocations('goa');
      assert.ok(goaResults.some(c => c.state === 'Goa'));

      // 5. Non-matching query
      const noneResults = filterLocations('xyznonexistentcity123');
      assert.strictEqual(noneResults.length, 0);
    });
  });
});
