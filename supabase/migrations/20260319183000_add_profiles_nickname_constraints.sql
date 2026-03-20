-- nickname 빈 문자열 금지
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_nickname_not_empty
CHECK (nickname <> '');

-- nickname 길이 제한 (<= 10)
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_nickname_max_length
CHECK (char_length(nickname) <= 10);