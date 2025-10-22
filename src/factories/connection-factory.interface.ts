// ========================
// src/factories/connection-factory.interface.ts
// ========================

import { BaseAdapter } from "../core/base-adapter";
import { DbConfig, IConnection } from "../types/orm.types";

/**
 * Interface cho Connection Factory
 * Mỗi database type sẽ có một factory riêng
 */
export interface IConnectionFactory {
  /**
   * Kiểm tra xem thư viện database có được cài đặt không
   */
  isSupported(): boolean;

  /**
   * Tạo connection với cấu hình cho trước
   */
  connect(adapter: BaseAdapter, config: DbConfig): Promise<IConnection>;
}
