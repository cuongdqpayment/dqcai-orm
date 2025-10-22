// ========================
// src/core/service-manager.ts
// ========================
import { ServiceConfig, ServiceStatus } from "../types/service.types";
import { BaseService } from "./base-service";

/**
 * Service Manager (Singleton)
 */
export class ServiceManager {
  private static instance: ServiceManager;
  private services: Map<string, BaseService<any>> = new Map();
  public serviceConfigs: Map<string, ServiceConfig> = new Map(); // Changed from private to public
  private cleanupInterval: any | null = null;
  private isShuttingDown: boolean = false;
  private cleanupThreshold: number = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    this.startPeriodicCleanup();
  }

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  private static getServiceKey(schemaName: string, entityName: string): string {
    return `${schemaName}:${entityName}`;
  }

  // --- Service Configuration ---

  public registerService(config: ServiceConfig): void {
    const key = ServiceManager.getServiceKey(
      config.schemaName,
      config.entityName
    );
    this.serviceConfigs.set(key, config);
  }

  public registerServices(configs: ServiceConfig[]): void {
    configs.forEach((config) => this.registerService(config));
  }

  public getServiceConfig(
    schemaName: string,
    entityName: string
  ): ServiceConfig | undefined {
    const key = ServiceManager.getServiceKey(schemaName, entityName);
    return this.serviceConfigs.get(key);
  }

  // --- Service Instance Management ---

  public async getService<T extends BaseService<any>>(
    schemaName: string,
    entityName: string
  ): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error("ServiceManager is shutting down");
    }

    const key = ServiceManager.getServiceKey(schemaName, entityName);

    // Return cached service
    let service = this.services.get(key);
    if (service) {
      service.lastAccess = Date.now();
      return service as T;
    }

    // Check configuration
    const config = this.serviceConfigs.get(key);
    if (!config) {
      throw new Error(`Service is not registered for ${key}`);
    }

    // Create and initialize new service
    const ServiceClass = config.serviceClass;
    service = new ServiceClass(schemaName, entityName);

    if (service && config.autoInit !== false) {
      await service.initialize();
    }

    if (service) this.services.set(key, service);

    return service as T;
  }

  public hasService(schemaName: string, entityName: string): boolean {
    const key = ServiceManager.getServiceKey(schemaName, entityName);
    return this.services.has(key);
  }

  public async destroyService(
    schemaName: string,
    entityName: string
  ): Promise<void> {
    const key = ServiceManager.getServiceKey(schemaName, entityName);
    const service = this.services.get(key);

    if (service) {
      await service.close();
      service.destroy();
      this.services.delete(key);
    }
  }

  // --- Cleanup Management ---

  private startPeriodicCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanupUnusedServices().catch((err) => {
        console.error("Error during service cleanup:", err);
      });
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  private stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  public async cleanupUnusedServices(): Promise<number> {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [key, service] of this.services.entries()) {
      const config = this.serviceConfigs.get(key);
      const threshold = config?.cacheTimeout || this.cleanupThreshold;

      if (now - service.lastAccess > threshold) {
        toRemove.push(key);
      }
    }

    for (const key of toRemove) {
      const [schemaName, entityName] = key.split(":");
      await this.destroyService(schemaName, entityName);
    }

    return toRemove.length;
  }

  public setCleanupThreshold(milliseconds: number): void {
    this.cleanupThreshold = milliseconds;
  }

  // --- Status & Information ---

  public getAllServiceInfo(): ServiceStatus[] {
    const infos: ServiceStatus[] = [];

    for (const [key, service] of this.services.entries()) {
      infos.push(service.getStatus());
    }

    return infos;
  }

  public getServiceInfo(
    schemaName: string,
    entityName: string
  ): ServiceStatus | null {
    const key = ServiceManager.getServiceKey(schemaName, entityName);
    const service = this.services.get(key);
    return service ? service.getStatus() : null;
  }

  public getStats(): {
    totalServices: number;
    activeServices: number;
    configurations: number;
  } {
    return {
      totalServices: this.services.size,
      activeServices: Array.from(this.services.values()).filter(
        (s) => s.getStatus().isOpened
      ).length,
      configurations: this.serviceConfigs.size,
    };
  }

  // --- Shutdown ---

  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.stopPeriodicCleanup();

    const keys = Array.from(this.services.keys());
    for (const key of keys) {
      const [schemaName, entityName] = key.split(":");
      await this.destroyService(schemaName, entityName);
    }

    this.services.clear();
  }

  public reset(): void {
    this.stopPeriodicCleanup();
    this.services.clear();
    this.serviceConfigs.clear();
    this.isShuttingDown = false;
  }
}

// Export singleton instance
export const serviceManager = ServiceManager.getInstance();
