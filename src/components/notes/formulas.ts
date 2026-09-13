import type { Node as PMNode } from "@tiptap/pm/model";

export type FormulaCellResult = {
  value: number | null;
  error: string | null;
  isFormula: boolean;
};

export type TableFormulaResult = {
  cells: FormulaCellResult[][];
  getCell: (row: number, column: number) => FormulaCellResult;
};

const EMPTY_RESULT: FormulaCellResult = { value: null, error: null, isFormula: false };

function numericValue(value: string) {
  const normalized = value
    .trim()
    .replace(/[,$€£¥₹%\s]/g, "")
    .replace(/^Rp/i, "");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function columnToIndex(column: string) {
  let result = 0;
  for (const character of column.toUpperCase()) {
    result = result * 26 + character.charCodeAt(0) - 64;
  }
  return result - 1;
}

function splitArguments(value: string) {
  return value
    .split(",")
    .map((argument) => argument.trim())
    .filter(Boolean);
}

function parseCellReference(value: string) {
  const match = value.trim().match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;

  return {
    column: columnToIndex(match[1]),
    row: Number(match[2]) - 1,
  };
}

function rangeCoordinates(value: string, formulaRow: number, rowCount: number) {
  const match = value.trim().match(/^([A-Z]+)(\d*)\s*:\s*([A-Z]+)(\d*)$/i);
  if (!match) return null;

  const startColumn = columnToIndex(match[1]);
  const endColumn = columnToIndex(match[3]);
  const startRow = match[2] ? Number(match[2]) - 1 : 0;
  // An open-ended range intentionally stops immediately above its formula
  // cell. This makes =SUM(B2:B) safe and useful for a total row that grows
  // when new rows are inserted above it.
  const endRow = match[4] ? Number(match[4]) - 1 : formulaRow - 1;

  if (
    !Number.isInteger(startColumn) ||
    !Number.isInteger(endColumn) ||
    !Number.isInteger(startRow) ||
    !Number.isInteger(endRow) ||
    startColumn < 0 ||
    endColumn < 0 ||
    startRow < 0 ||
    endRow < 0
  ) {
    return null;
  }

  const coordinates: Array<{ row: number; column: number }> = [];
  const firstRow = Math.min(startRow, endRow);
  const lastRow = Math.min(Math.max(startRow, endRow), rowCount - 1);
  const firstColumn = Math.min(startColumn, endColumn);
  const lastColumn = Math.max(startColumn, endColumn);

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      coordinates.push({ row, column });
    }
  }

  return coordinates;
}

function formatError(error: string) {
  return error;
}

export function isFormula(value: string) {
  return value.trim().startsWith("=");
}

export function formatFormulaValue(result: FormulaCellResult) {
  if (result.error) return formatError(result.error);
  if (result.value === null) return "0";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(result.value);
}

export function evaluateTableFormulas(table: PMNode): TableFormulaResult {
  const rows = Array.from({ length: table.childCount }, (_, row) => table.child(row));
  const cells = rows.map((row) => Array.from({ length: row.childCount }, () => EMPTY_RESULT));
  const visiting = new Set<string>();

  const getCell = (row: number, column: number): FormulaCellResult => {
    const key = `${row}:${column}`;
    const cell = rows[row]?.child(column);
    if (!cell) return { value: null, error: "#REF!", isFormula: false };

    const rawValue = cell.textContent.trim();
    if (!isFormula(rawValue)) {
      const result = { value: numericValue(rawValue), error: null, isFormula: false };
      cells[row][column] = result;
      return result;
    }

    if (cells[row]?.[column]?.isFormula && !visiting.has(key)) return cells[row][column];
    if (visiting.has(key)) return { value: null, error: "#CIRCULAR!", isFormula: true };

    visiting.add(key);
    const formulaMatch = rawValue.match(/^=\s*SUM\s*\((.*)\)\s*$/i);
    let result: FormulaCellResult;

    if (!formulaMatch) {
      result = { value: null, error: "#NAME?", isFormula: true };
    } else {
      let total = 0;
      let error: string | null = null;
      const argumentsList = splitArguments(formulaMatch[1]);

      for (const argument of argumentsList) {
        const reference = parseCellReference(argument);
        const range = rangeCoordinates(argument, row, rows.length);
        const references = reference ? [reference] : range;

        if (!references) {
          error = "#REF!";
          break;
        }

        for (const coordinate of references) {
          const referencedCell = getCell(coordinate.row, coordinate.column);
          if (referencedCell.error) {
            error = referencedCell.error;
            break;
          }
          if (referencedCell.value !== null) total += referencedCell.value;
        }

        if (error) break;
      }

      result = { value: error ? null : total, error, isFormula: true };
    }

    visiting.delete(key);
    cells[row][column] = result;
    return result;
  };

  for (let row = 0; row < rows.length; row += 1) {
    for (let column = 0; column < rows[row].childCount; column += 1) getCell(row, column);
  }

  return {
    cells,
    getCell: (row, column) => cells[row]?.[column] ?? getCell(row, column),
  };
}

export function updateFormulaDisplays(editor: { state: { doc: PMNode }; view: { dom: HTMLElement } }) {
  const tableElements = Array.from(editor.view.dom.querySelectorAll("table"));
  let tableIndex = 0;

  editor.state.doc.descendants((node) => {
    if (node.type.name !== "table") return true;

    const tableElement = tableElements[tableIndex];
    tableIndex += 1;
    if (!tableElement) return false;

    const evaluation = evaluateTableFormulas(node);
    const rowElements = Array.from(tableElement.querySelectorAll("tbody > tr"));

    for (let row = 0; row < node.childCount; row += 1) {
      const rowElement = rowElements[row];
      const rowNode = node.child(row);
      if (!rowElement) continue;

      for (let column = 0; column < rowNode.childCount; column += 1) {
        const cellElement = rowElement.children[column];
        const cellNode = rowNode.child(column);
        if (!(cellElement instanceof HTMLElement)) continue;

        const rawValue = cellNode.textContent.trim();
        if (!isFormula(rawValue)) {
          cellElement.removeAttribute("data-formula");
          cellElement.removeAttribute("data-formula-value");
          cellElement.removeAttribute("data-formula-error");
          continue;
        }

        const result = evaluation.getCell(row, column);
        cellElement.setAttribute("data-formula", rawValue);
        cellElement.setAttribute("data-formula-value", formatFormulaValue(result));
        if (result.error) cellElement.setAttribute("data-formula-error", "true");
        else cellElement.removeAttribute("data-formula-error");
      }
    }

    return false;
  });
}
