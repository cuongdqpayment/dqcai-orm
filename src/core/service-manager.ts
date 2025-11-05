// ========================
// src/core/service-manager.ts
// ========================
import {
  HealthReport,
  ServiceConfig,
  ServiceHealthStatus,
  ServiceManagerEvent,
  ServiceManagerEventHandler,
  ServiceStatus,
} from "../types/service.types";
import { BaseService } from "./base-service";

import { createModuleLogger, ORMModules } from "../logger";
const logger = createModuleLogger(ORMModules.SERVICE_MANAGER);

// Concrete service class mặc định
export class DefaultService extends BaseService {
  // BaseService đã cung cấp đầy đủ functionality
}
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
  private serviceMetadata: Map<
    string,
    { createdAt: string; lastAccessed?: string }
  > = new Map();
  // Event system
  private eventHandlers: Map<string, ServiceManagerEventHandler[]> = new Map();

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
    const serviceKey = ServiceManager.getServiceKey(
      config.schemaName,
      config.entityName
    );

    // Normalize config
    const normalizedConfig: ServiceConfig = {
      schemaName: config.schemaName.trim(),
      entityName: config.entityName.trim(),
      serviceClass: config.serviceClass || DefaultService,
    };

    const wasAlreadyRegistered = this.serviceConfigs.has(serviceKey);
    this.serviceConfigs.set(serviceKey, normalizedConfig);

    if (wasAlreadyRegistered) {
      logger.info("Service configuration updated", { serviceKey });
    } else {
      logger.info("Service registered successfully", { serviceKey });
    }
  }

  public registerServices(configs: ServiceConfig[]): void {
    logger.debug("Registering multiple service configs", {
      configCount: configs.length,
    });

    configs.forEach((config) => this.registerService(config));

    logger.info("Multiple service configs registered successfully", {
      configCount: configs.length,
    });
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

  /**
   * Tạo service instance từ config
   */
  private async createServiceInstance(
    config: ServiceConfig
  ): Promise<BaseService> {
    logger.debug("Creating service instance", {
      schemaName: config.schemaName,
      entityName: config.entityName,
      serviceClassName: config.serviceClass?.name || "DefaultService",
      serviceClass: config.serviceClass, // Thêm dòng này
      isDefaultService: config.serviceClass === DefaultService,
    });

    const ServiceClass = config.serviceClass || DefaultService;

    // Thêm validation
    if (!ServiceClass) {
      logger.error("ServiceClass is undefined", { config });
      throw new Error("ServiceClass is undefined");
    }

    logger.debug("About to instantiate service", {
      ServiceClassConstructor: ServiceClass,
      ServiceClassName: ServiceClass.name,
    });

    const service: any = new ServiceClass(config.schemaName, config.entityName);

    // Verify instance type
    logger.debug("Service instance created", {
      serviceConstructor: service.constructor.name,
      servicePrototype: Object.getPrototypeOf(service).constructor.name,
      hasFindByStoreId: typeof service.findByStoreId === "function",
    });

    logger.info("Service instance created successfully", {
      schemaName: config.schemaName,
      entityName: config.entityName,
    });

    return service;
  }

  public async getService<T extends BaseService<any>>(
    schemaName: string,
    entityName: string
  ): Promise<T> {
    logger.trace("Getting service", { schemaName, entityName });

    if (this.isShuttingDown) {
      logger.error("ServiceManager is shutting down", {
        schemaName,
        entityName,
      });
      throw new Error("ServiceManager is shutting down");
    }

    const serviceKey = ServiceManager.getServiceKey(schemaName, entityName);

    const metadata = this.serviceMetadata.get(serviceKey);
    if (metadata) {
      metadata.lastAccessed = new Date().toISOString();
      logger.trace("Updated service access time", { serviceKey });
    }

    // Return existing service
    let service = this.services.get(serviceKey);
    if (this.services.has(serviceKey) && service) {
      logger.trace("Returning existing service", { serviceKey });
      // Return cached service

      service.lastAccess = Date.now();

      logger.debug("Returning cached service", { serviceKey });

      return service as T;
    }

    logger.debug("No cached service found, checking config", { serviceKey });

    // Check configuration
    let config = this.serviceConfigs.get(serviceKey);
    if (!config) {
      logger.debug("Creating default config for unregistered service", {
        serviceKey,
      });
      config = {
        schemaName,
        entityName,
        serviceClass: DefaultService,
      };
      this.serviceConfigs.set(serviceKey, config);
    }

    logger.debug("Creating new service instance", {
      serviceKey,
      schemaName,
      entityName,
    });

    try {
      const service = await this.createServiceInstance(config);
      this.services.set(serviceKey, service);

      // Track metadata
      this.serviceMetadata.set(serviceKey, {
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
      });

      this.emit("SERVICE_CREATED", {
        serviceKey,
        schemaName,
        entityName,
      });

      logger.info("Service created and cached successfully", { serviceKey });
      return service as T;
    } catch (error) {
      logger.error("Failed to create service", {
        serviceKey,
        error: (error as Error).message,
      });

      this.emit("SERVICE_ERROR", {
        serviceKey,
        schemaName,
        entityName,
        error: error as Error,
      });
      throw error;
    }
  }

  public hasService(schemaName: string, entityName: string): boolean {
    const key = ServiceManager.getServiceKey(schemaName, entityName);

    logger.trace("Checking if service exists", { schemaName, entityName, key });

    return this.services.has(key);
  }

  /**
   * Kiểm tra sức khỏe của tất cả services
   * @returns Báo cáo chi tiết về health status của từng service
   * @example
   * const report = await serviceManager.healthCheck();
   * console.log(`Healthy: ${report.healthyServices}/${report.totalServices}`);
   *
   * // Check specific service
   * const unhealthy = report.services.filter(s => !s.healthy);
   * unhealthy.forEach(s => console.log(`${s.serviceKey}: ${s.error}`));
   */
  public async healthCheck(): Promise<HealthReport> {
    const startTime = Date.now();

    logger.info("Starting health check for all services", {
      totalServices: this.services.size,
    });

    const services = Array.from(this.services.entries());

    const healthPromises = services.map(async ([serviceKey, service]) => {
      const checkStart = Date.now();
      const [schemaName, entityName] = serviceKey.split(":");

      try {
        logger.trace("Checking service health", { serviceKey });

        const isHealthy = await service.healthCheck();
        const responseTime = Date.now() - checkStart;

        const status = service.getStatus();

        logger.trace("Service health check completed", {
          serviceKey,
          healthy: isHealthy,
          responseTime,
        });

        return {
          serviceKey,
          schemaName,
          entityName,
          healthy: isHealthy,
          timestamp: new Date().toISOString(),
          responseTime,
          connectionStatus: status.connectionStatus,
        } as ServiceHealthStatus;
      } catch (error) {
        const responseTime = Date.now() - checkStart;

        logger.warn("Service health check failed", {
          serviceKey,
          error: (error as Error).message,
          responseTime,
        });

        return {
          serviceKey,
          schemaName,
          entityName,
          healthy: false,
          error: (error as Error).message,
          timestamp: new Date().toISOString(),
          responseTime,
          connectionStatus: "unknown" as const,
        } as ServiceHealthStatus;
      }
    });

    const results = await Promise.all(healthPromises);
    const healthyCount = results.filter((r) => r.healthy).length;
    const checkDuration = Date.now() - startTime;

    const report: HealthReport = {
      totalServices: results.length,
      healthyServices: healthyCount,
      unhealthyServices: results.length - healthyCount,
      services: results,
      timestamp: new Date().toISOString(),
      overallHealth: healthyCount === results.length,
      checkDuration,
    };

    logger.info("Health check completed", {
      totalServices: report.totalServices,
      healthyServices: report.healthyServices,
      unhealthyServices: report.unhealthyServices,
      overallHealth: report.overallHealth,
      duration: checkDuration,
    });

    this.emit("HEALTH_CHECK_COMPLETED", {
      serviceKey: "*",
      schemaName: "*",
      entityName: "*",
      data: report,
    });

    return report;
  }

  /**
   * Kiểm tra sức khỏe của một service cụ thể
   * @param schemaName - Tên schema
   * @param entityName - Tên entity
   * @returns Health status của service hoặc null nếu không tồn tại
   */
  public async checkServiceHealth(
    schemaName: string,
    entityName: string
  ): Promise<ServiceHealthStatus | null> {
    const serviceKey = ServiceManager.getServiceKey(schemaName, entityName);

    logger.debug("Checking health for specific service", {
      schemaName,
      entityName,
      serviceKey,
    });

    const service = this.services.get(serviceKey);

    if (!service) {
      logger.warn("Service not found for health check", { serviceKey });
      return null;
    }

    const checkStart = Date.now();

    try {
      const isHealthy = await service.healthCheck();
      const responseTime = Date.now() - checkStart;
      const status = service.getStatus();

      logger.debug("Service health check completed", {
        serviceKey,
        healthy: isHealthy,
        responseTime,
      });

      return {
        serviceKey,
        schemaName,
        entityName,
        healthy: isHealthy,
        timestamp: new Date().toISOString(),
        responseTime,
        connectionStatus: status.connectionStatus as any,
      };
    } catch (error) {
      const responseTime = Date.now() - checkStart;

      logger.error("Service health check failed", {
        serviceKey,
        error: (error as Error).message,
        responseTime,
      });

      return {
        serviceKey,
        schemaName,
        entityName,
        healthy: false,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
        responseTime,
        connectionStatus: "unknown",
      };
    }
  }

  /**
   * Kiểm tra sức khỏe của tất cả services trong một schema
   * @param schemaName - Tên schema
   * @returns Health report cho schema cụ thể
   */
  public async checkSchemaHealth(schemaName: string): Promise<HealthReport> {
    const startTime = Date.now();

    logger.info("Starting schema health check", { schemaName });

    const services = this.getServicesBySchema(schemaName);

    if (services.length === 0) {
      logger.warn("No services found for schema health check", { schemaName });

      return {
        totalServices: 0,
        healthyServices: 0,
        unhealthyServices: 0,
        services: [],
        timestamp: new Date().toISOString(),
        overallHealth: true,
        checkDuration: Date.now() - startTime,
      };
    }

    const healthPromises = services.map(async (service) => {
      const serviceKey = ServiceManager.getServiceKey(
        service.getSchemaKey(),
        service.getEntityName()
      );
      const checkStart = Date.now();

      try {
        const isHealthy = await service.healthCheck();
        const responseTime = Date.now() - checkStart;
        const status = service.getStatus();

        return {
          serviceKey,
          schemaName: service.getSchemaKey(),
          entityName: service.getEntityName(),
          healthy: isHealthy,
          timestamp: new Date().toISOString(),
          responseTime,
          connectionStatus: status.connectionStatus,
        } as ServiceHealthStatus;
      } catch (error) {
        const responseTime = Date.now() - checkStart;

        return {
          serviceKey,
          schemaName: service.getSchemaKey(),
          entityName: service.getEntityName(),
          healthy: false,
          error: (error as Error).message,
          timestamp: new Date().toISOString(),
          responseTime,
          connectionStatus: "unknown" as const,
        } as ServiceHealthStatus;
      }
    });

    const results = await Promise.all(healthPromises);
    const healthyCount = results.filter((r) => r.healthy).length;
    const checkDuration = Date.now() - startTime;

    const report: HealthReport = {
      totalServices: results.length,
      healthyServices: healthyCount,
      unhealthyServices: results.length - healthyCount,
      services: results,
      timestamp: new Date().toISOString(),
      overallHealth: healthyCount === results.length,
      checkDuration,
    };

    logger.info("Schema health check completed", {
      schemaName,
      totalServices: report.totalServices,
      healthyServices: report.healthyServices,
      unhealthyServices: report.unhealthyServices,
      overallHealth: report.overallHealth,
      duration: checkDuration,
    });

    this.emit("HEALTH_CHECK_COMPLETED", {
      serviceKey: `${schemaName}:*`,
      schemaName,
      entityName: "*",
      data: report,
    });

    return report;
  }

  /**
   * Lấy tất cả services thuộc một schema
   */
  public getServicesBySchema(schemaName: string): BaseService<any>[] {
    logger.trace("Getting services by schema", { schemaName });

    const services: BaseService<any>[] = [];

    for (const [key, service] of this.services.entries()) {
      const [serviceSchemaName] = key.split(":");
      if (serviceSchemaName === schemaName) {
        services.push(service);
      }
    }

    logger.debug("Services found for schema", {
      schemaName,
      count: services.length,
      serviceKeys: Array.from(this.services.keys()).filter((k) =>
        k.startsWith(`${schemaName}:`)
      ),
    });

    return services;
  }

  /**
   * Thực hiện transaction trên nhiều services trong cùng schema
   * @param schemaName - Tên schema chứa các services
   * @param callback - Function thực thi trong transaction, nhận array các services
   * @returns Kết quả từ callback
   * @example
   * await serviceManager.executeSchemaTransaction('mydb', async (services) => {
   *   // Tất cả operations trong đây sẽ được wrap trong transaction
   *   await services[0].create({ name: 'User 1' });
   *   await services[1].create({ title: 'Post 1' });
   *   return { success: true };
   * });
   */
  public async executeSchemaTransaction<T>(
    schemaName: string,
    callback: (services: BaseService<any>[]) => Promise<T>
  ): Promise<T> {
    logger.debug("Executing schema transaction", { schemaName });

    if (this.isShuttingDown) {
      logger.error("Cannot execute transaction during shutdown", {
        schemaName,
      });
      throw new Error("ServiceManager is shutting down");
    }

    const services = this.getServicesBySchema(schemaName);

    if (services.length === 0) {
      logger.error("No services found for schema", { schemaName });
      throw new Error(`No services found for schema: ${schemaName}`);
    }

    logger.debug("Found services for transaction", {
      schemaName,
      serviceCount: services.length,
    });

    try {
      // Ensure all services are initialized
      for (const service of services) {
        logger.trace("Ensuring service is initialized", {
          schemaName,
          entityName: service.getEntityName(),
        });
        await service.initialize();
      }

      // Execute transaction on the first service (they share the same database)
      const primaryService = services[0];

      logger.debug("Starting transaction on primary service", {
        schemaName,
        primaryEntityName: primaryService.getEntityName(),
      });

      const result = await primaryService.withTransaction(async () => {
        return await callback(services);
      });

      logger.info("Schema transaction completed successfully", {
        schemaName,
        serviceCount: services.length,
      });

      this.emit("TRANSACTION_COMPLETED", {
        serviceKey: `${schemaName}:*`,
        schemaName,
        entityName: "*",
      });

      return result;
    } catch (error) {
      logger.error("Schema transaction failed", {
        schemaName,
        error: (error as Error).message,
        serviceCount: services.length,
      });

      this.emit("TRANSACTION_FAILED", {
        serviceKey: `${schemaName}:*`,
        schemaName,
        entityName: "*",
        error: error as Error,
      });

      throw error;
    }
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
    logger.debug("Starting cleanup of unused services", {
      thresholdMs: this.cleanupThreshold,
    });

    const now = Date.now();
    const toRemove: string[] = [];

    for (const [key, service] of this.services.entries()) {
      const config = this.serviceConfigs.get(key);
      const threshold = config?.cacheTimeout || this.cleanupThreshold;

      logger.trace("Checking service for cleanup", {
        key,
        lastAccess: service.lastAccess,
        threshold,
      });

      if (now - service.lastAccess > threshold) {
        toRemove.push(key);
      }
    }

    logger.debug("Services to remove during cleanup", {
      toRemoveCount: toRemove.length,
      keys: toRemove,
    });

    for (const key of toRemove) {
      const [schemaName, entityName] = key.split(":");
      await this.destroyService(schemaName, entityName);
    }

    logger.info("Cleanup completed", { removedCount: toRemove.length });

    return toRemove.length;
  }

  public setCleanupThreshold(milliseconds: number): void {
    logger.debug("Setting cleanup threshold", {
      oldThreshold: this.cleanupThreshold,
      newThreshold: milliseconds,
    });

    this.cleanupThreshold = milliseconds;
  }

  // --- Status & Information ---

  public getAllServiceInfo(): ServiceStatus[] {
    logger.trace("Getting all service info", {
      totalServices: this.services.size,
    });

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

    logger.trace("Getting ServiceManager stats", {
      totalServices: this.services.size,
      activeServices,
      configurations: this.serviceConfigs.size,
    });

    return {
      totalServices: this.services.size,
      activeServices,
      configurations: this.serviceConfigs.size,
    };
  }

  // --- Shutdown ---

  public async shutdown(): Promise<void> {
    logger.info("Starting ServiceManager shutdown", {
      totalServices: this.services.size,
    });

    this.isShuttingDown = true;
    this.stopPeriodicCleanup();

    const keys = Array.from(this.services.keys());
    for (const key of keys) {
      const [schemaName, entityName] = key.split(":");
      logger.debug("Destroying service during shutdown", {
        schemaName,
        entityName,
        key,
      });
      await this.destroyService(schemaName, entityName);
    }

    this.services.clear();

    logger.info("ServiceManager shutdown completed");
  }

  public reset(): void {
    logger.warn("Resetting ServiceManager", {
      totalServices: this.services.size,
      configurations: this.serviceConfigs.size,
    });

    this.stopPeriodicCleanup();
    this.services.clear();
    this.serviceConfigs.clear();
    this.isShuttingDown = false;

    logger.debug("ServiceManager reset completed");
  }

  private emit(
    type: ServiceManagerEvent["type"],
    data: Omit<ServiceManagerEvent, "type" | "timestamp">
  ): void {
    const event: ServiceManagerEvent = {
      ...data,
      type,
      timestamp: new Date().toISOString(),
    };

    // Emit to specific event handlers
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error(
            `ServiceManager: Error in ${type} event handler:`,
            error
          );
        }
      });
    }

    // Emit to global event handlers
    const globalHandlers = this.eventHandlers.get("*");
    if (globalHandlers) {
      globalHandlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error(
            "ServiceManager: Error in global event handler:",
            error
          );
        }
      });
    }
  }
}

// Export singleton instance
export const serviceManager = ServiceManager.getInstance();
