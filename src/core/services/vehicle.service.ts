import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { VehiclePhoto } from '../models/ride.models';

@Injectable({
  providedIn: 'root'
})
export class VehicleService {
  private http = inject(HttpClient);

  getVehiclePhotos(vehicleId: string): Observable<{ photos: VehiclePhoto[] }> {
    return this.http.get<{ photos: VehiclePhoto[] }>(`/api/vehicles/${vehicleId}/photos`);
  }

  uploadVehiclePhoto(vehicleId: string, photoBase64: string): Observable<{ success: boolean; photo: VehiclePhoto; photos: VehiclePhoto[] }> {
    return this.http.post<{ success: boolean; photo: VehiclePhoto; photos: VehiclePhoto[] }>(
      `/api/vehicles/${vehicleId}/photos`,
      { photo: photoBase64 }
    );
  }

  replaceVehiclePhoto(vehicleId: string, photoId: string, photoBase64: string): Observable<{ success: boolean; photo: VehiclePhoto; photos: VehiclePhoto[] }> {
    return this.http.put<{ success: boolean; photo: VehiclePhoto; photos: VehiclePhoto[] }>(
      `/api/vehicles/${vehicleId}/photos/${photoId}`,
      { photo: photoBase64 }
    );
  }

  deleteVehiclePhoto(vehicleId: string, photoId: string): Observable<{ success: boolean; message: string; photos: VehiclePhoto[] }> {
    return this.http.delete<{ success: boolean; message: string; photos: VehiclePhoto[] }>(
      `/api/vehicles/${vehicleId}/photos/${photoId}`
    );
  }

  addVehicle(vehicle: { model: string; numberPlate: string; type?: string; color?: string }): Observable<{ vehicle: any }> {
    return this.http.post<{ vehicle: any }>('/api/vehicles', vehicle);
  }
}
