// ========================
// src/core/service-manager.ts
// ========================
import { ServiceConfig, ServiceStatus } from "../types/service.types";
import { BaseService } from "./base-service";

import { createModuleLogger, ORMModules } from "../logger";
const logger = createModuleLogger(ORMModules.SERVICE_MANAGER);

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
    logger.trace("Creating ServiceManager singleton instance");

    this.startPeriodicCleanup();

    logger.debug("ServiceManager instance created successfully");
  }

  public static getInstance(): ServiceManager {
    logger.trace("Getting ServiceManager instance");

    if (!ServiceManager.instance) {
      logger.debug("No existing instance, creating new ServiceManager");
      ServiceManager.instance = new ServiceManager();
    }

    return ServiceManager.instance;
  }

  private static getServiceKey(schemaName: string, entityName: string): string {
    const key = `${schemaName}:${entityName}`;

    logger.trace("Generated service key", { schemaName, entityName, key });

    return key;
  }

  // --- Service Configuration ---

  public registerService(config: ServiceConfig): void {
    const key = ServiceManager.getServiceKey(
      config.schemaName,
      config.entityName
    );

    logger.debug("Registering service config", { key, schemaName: config.schemaName, entityName: config.entityName });

    this.serviceConfigs.set(key, config);
  }

  public registerServices(configs: ServiceConfig[]): void {
    logger.debug("Registering multiple service configs", { configCount: configs.length });

    configs.forEach((config) => this.registerService(config));

    logger.info("Multiple service configs registered successfully", { configCount: configs.length });
  }

  public getServiceConfig(
    schemaName: string,
    entityName: string
  ): ServiceConfig | undefined {
    const key = ServiceManager.getServiceKey(schemaName, entityName);

    logger.trace("Getting service config", { schemaName, entityName, key });

    return this.serviceConfigs.get(key);
  }

  // --- Service Instance Management ---

  public async getService<T extends BaseService<any>>(
    schemaName: string,
    entityName: string
  ): Promise<T> {
    logger.trace("Getting service", { schemaName, entityName });

    if (this.isShuttingDown) {
      logger.error("ServiceManager is shutting down", { schemaName, entityName });
      throw new Error("ServiceManager is shutting down");
    }

    const key = ServiceManager.getServiceKey(schemaName, entityName);

    // Return cached service
    let service = this.services.get(key);
    if (service) {
      service.lastAccess = Date.now();

      logger.debug("Returning cached service", { key });

      return service as T;
    }

    logger.debug("No cached service found, checking config", { key });

    // Check configuration
    const config = this.serviceConfigs.get(key);
    if (!config) {
      logger.error("Service config not found", { key, schemaName, entityName });
      throw new Error(`Service is not registered for ${key}`);
    }

    logger.debug("Creating new service instance", { key, schemaName, entityName });

    // Create and initialize new service
    const ServiceClass = config.serviceClass;
    service = new ServiceClass(schemaName, entityName);

    if (service && config.autoInit !== false) {
      logger.debug("Initializing new service", { key });
      await service.initialize();
    }

    if (service) {
      this.services.set(key, service);

      logger.info("New service created and cached successfully", { key });
    }

    return service as T;
  }

  public hasService(schemaName: string, entityName: string): boolean {
    const key = ServiceManager.getServiceKey(schemaName, entityName);

    logger.trace("Checking if service exists", { schemaName, entityName, key });

    return this.services.has(key);
  }

  public async destroyService(
    schemaName: string,
    entityName: string
  ): Promise<void> {
    const key = ServiceManager.getServiceKey(schemaName, entityName);

    logger.debug("Destroying service", { schemaName, entityName, key });

    const service = this.services.get(key);

    if (service) {
      logger.debug("Closing service before destroy", { key });
      await service.close();
      service.destroy();
      this.services.delete(key);

      logger.info("Service destroyed successfully", { key });
    } else {
      logger.warn("No service found to destroy", { key });
    }
  }

  // --- Cleanup Management ---

  private startPeriodicCleanup(): void {
    logger.trace("Starting periodic cleanup");

    if (this.cleanupInterval) {
      logger.debug("Periodic cleanup already running, skipping start");
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupUnusedServices().catch((err) => {
        logger.error("Error during service cleanup", { error: err.message });
      });
    }, 5 * 60 * 1000); // Run every 5 minutes

    logger.info("Periodic cleanup started", { intervalMs: 5 * 60 * 1000 });
  }

  private stopPeriodicCleanup(): void {
    logger.trace("Stopping periodic cleanup");

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;

      logger.debug("Periodic cleanup stopped");
    }
  }

  public async cleanupUnusedServices(): Promise<number> {
    logger.debug("Starting cleanup of unused services", { thresholdMs: this.cleanupThreshold });

    const now = Date.now();
    const toRemove: string[] = [];

    for (const [key, service] of this.services.entries()) {
      const config = this.serviceConfigs.get(key);
      const threshold = config?.cacheTimeout || this.cleanupThreshold;

      logger.trace("Checking service for cleanup", { key, lastAccess: service.lastAccess, threshold });

      if (now - service.lastAccess > threshold) {
        toRemove.push(key);
      }
    }

    logger.debug("Services to remove during cleanup", { toRemoveCount: toRemove.length, keys: toRemove });

    for (const key of toRemove) {
      const [schemaName, entityName] = key.split(":");
      await this.destroyService(schemaName, entityName);
    }

    logger.info("Cleanup completed", { removedCount: toRemove.length });

    return toRemove.length;
  }

  public setCleanupThreshold(milliseconds: number): void {
    logger.debug("Setting cleanup threshold", { oldThreshold: this.cleanupThreshold, newThreshold: milliseconds });

    this.cleanupThreshold = milliseconds;
  }

  // --- Status & Information ---

  public getAllServiceInfo(): ServiceStatus[] {
    logger.trace("Getting all service info", { totalServices: this.services.size });

    const infos: ServiceStatus[] = [];

    for (const [key, service] of this.services.entries()) {
      logger.trace("Collecting status for service", { key });
      infos.push(service.getStatus());
    }

    logger.debug("All service info retrieved", { infoCount: infos.length });

    return infos;
  }

  public getServiceInfo(
    schemaName: string,
    entityName: string
  ): ServiceStatus | null {
    const key = ServiceManager.getServiceKey(schemaName, entityName);

    logger.trace("Getting service info", { schemaName, entityName, key });

    const service = this.services.get(key);
    return service ? service.getStatus() : null;
  }

  public getStats(): {
    totalServices: number;
    activeServices: number;
    configurations: number;
  } {
    const activeServices = Array.from(this.services.values()).filter(
      (s) => s.getStatus().isOpened
    ).length;

    logger.trace("Getting ServiceManager stats", { totalServices: this.services.size, activeServices, configurations: this.serviceConfigs.size });

    return {
      totalServices: this.services.size,
      activeServices,
      configurations: this.serviceConfigs.size,
    };
  }

  // --- Shutdown ---

  public async shutdown(): Promise<void> {
    logger.info("Starting ServiceManager shutdown", { totalServices: this.services.size });

    this.isShuttingDown = true;
    this.stopPeriodicCleanup();

    const keys = Array.from(this.services.keys());
    for (const key of keys) {
      const [schemaName, entityName] = key.split(":");
      logger.debug("Destroying service during shutdown", { schemaName, entityName, key });
      await this.destroyService(schemaName, entityName);
    }

    this.services.clear();

    logger.info("ServiceManager shutdown completed");
  }

  public reset(): void {
    logger.warn("Resetting ServiceManager", { 
      totalServices: this.services.size,
      configurations: this.serviceConfigs.size
    });

    this.stopPeriodicCleanup();
    this.services.clear();
    this.serviceConfigs.clear();
    this.isShuttingDown = false;

    logger.debug("ServiceManager reset completed");
  }
}

// Export singleton instance
export const serviceManager = ServiceManager.getInstance();