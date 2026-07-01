INSERT INTO cardholders (cardholder_name, last_four_digits)
SELECT 'Jose', '8593'
WHERE NOT EXISTS (
    SELECT 1 FROM cardholders WHERE last_four_digits = '8593'
);

INSERT INTO cardholders (cardholder_name, last_four_digits)
SELECT 'Xiwei', '6954'
WHERE NOT EXISTS (
  SELECT 1 FROM cardholders WHERE last_four_digits = '6954'
);

INSERT INTO cardholders (cardholder_name, last_four_digits)
SELECT 'Hawau', '4924'
WHERE NOT EXISTS (
  SELECT 1 FROM cardholders WHERE last_four_digits = '4924'
);

INSERT INTO cardholders (cardholder_name, last_four_digits)
SELECT 'Seung', '9570'
WHERE NOT EXISTS (
  SELECT 1 FROM cardholders WHERE last_four_digits = '9570'
);