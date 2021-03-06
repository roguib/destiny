import { readFileSync, writeFileSync } from "fs-extra";
import { findImports } from "../shared/findImports";
import path from "path";
import { makeImportPath } from "./fixImports/makeImportPath";
import { customResolve } from "../shared/customResolve";
import { RootOption } from "../shared/RootOption";
import logger from "../../shared/logger";

const getNewFilePath = (file: string, rootOptions: RootOption[]) => {
  for (const { tree, parentFolder } of rootOptions) {
    const key = path.relative(parentFolder, file);
    if (key in tree) {
      return path.resolve(path.join(parentFolder, tree[key]));
    }
  }

  return file;
};

const getNewImportPath = (
  absImportPath: string,
  newFilePath: string,
  rootOptions: RootOption[]
) => {
  for (const { tree, parentFolder } of rootOptions) {
    const key = path.relative(parentFolder, absImportPath);

    if (key in tree) {
      return makeImportPath(
        newFilePath,
        path.resolve(path.join(parentFolder, tree[key]))
      );
    }
  }

  return makeImportPath(newFilePath, absImportPath);
};

const getNumOfNewChar = (a: number, b: number) => {
  const numOfNewChar = b - a;

  // less char than before
  if (a > b) return -Math.abs(numOfNewChar);

  return numOfNewChar;
};

export const fixImports = (filePaths: string[], rootOptions: RootOption[]) => {
  for (const filePath of filePaths) {
    logger.debug(`checking imports of "${filePath}"`);
    const importPaths = findImports(filePath);

    if (importPaths.length === 0) {
      logger.debug(`no import found in "${filePath}"`);
      continue;
    }

    const basedir = path.dirname(filePath);
    const newFilePath = getNewFilePath(filePath, rootOptions);
    const ogText = readFileSync(filePath).toString();

    let newText = ogText;
    let numOfNewChar = 0;

    for (const _import of importPaths) {
      const absPath = customResolve(_import.path, basedir);

      if (absPath == null) {
        logger.error(`Cannot find import ${_import.path} for ${basedir}`);
        continue;
      }

      const newImportPath = getNewImportPath(absPath, newFilePath, rootOptions);

      if (newImportPath != null && _import.path !== newImportPath) {
        logger.debug(
          `replacing import of "${_import.path}" by "${newImportPath}" in "${filePath}"`
        );

        newText = `${newText.substr(
          0,
          _import.start + numOfNewChar
        )}${newImportPath}${newText.substring(_import.end + numOfNewChar)}`;

        numOfNewChar += getNumOfNewChar(
          _import.path.length,
          newImportPath.length
        );
      }
    }

    if (newText !== ogText) {
      logger.debug(`writing new imports of "${filePath}"`);
      writeFileSync(filePath, newText);
    }
  }
};
