import type {
  OperationalErrorSeverityType,
  OperationalErrorStatusType,
} from "@/features/operational-errors/constants";
import type { InsertDto, Row, UpdateDto } from "@/types/db.helpers";

type OperationalErrorRow = Omit<
  Row<"operational_errors">,
  "severity" | "status"
> & {
  severity: OperationalErrorSeverityType;
  status: OperationalErrorStatusType;
};

export type OperationalError = OperationalErrorRow;
export type OperationalErrorInsert = InsertDto<"operational_errors">;
export type OperationalErrorUpdate = UpdateDto<"operational_errors">;
