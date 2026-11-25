declare module "multer" {
  import type { RequestHandler } from "express";

  interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }

  interface MulterOptions {
    storage?: unknown;
    limits?: { fileSize?: number };
    fileFilter?: (
      req: unknown,
      file: MulterFile,
      cb: (error: Error | null, acceptFile?: boolean) => void
    ) => void;
  }

  interface MulterInstance {
    single(fieldName: string): RequestHandler;
  }

  interface MulterFunction {
    (options?: MulterOptions): MulterInstance;
    memoryStorage(): unknown;
  }

  const multer: MulterFunction;
  export default multer;

  global {
    namespace Express {
      interface Request {
        file?: MulterFile;
      }
    }
  }
}
