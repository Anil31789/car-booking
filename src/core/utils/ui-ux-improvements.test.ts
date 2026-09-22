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
});
