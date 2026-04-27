-- Rename all Location codes to Excel-style: colToLetter(col) + row
-- e.g. col=0,row=1 → A1 ; col=1,row=2 → B2 ; col=26,row=1 → AA1

CREATE OR REPLACE FUNCTION _col_to_letter(n INTEGER) RETURNS TEXT AS $$
DECLARE result TEXT := '';
BEGIN
  WHILE n >= 0 LOOP
    result := CHR(65 + (n % 26)) || result;
    n := (n / 26) - 1;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

UPDATE "Location" SET code = _col_to_letter(col) || CAST(row AS TEXT);

DROP FUNCTION IF EXISTS _col_to_letter(INTEGER);
