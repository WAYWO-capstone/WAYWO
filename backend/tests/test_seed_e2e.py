from scripts.seed_e2e import is_test_database


def test_accepts_test_databases() -> None:
    assert is_test_database("postgresql://u:p@localhost/waywo_test")
    assert is_test_database("postgresql://u:p@localhost/waywo_ci")


def test_refuses_other_databases() -> None:
    assert not is_test_database("postgresql://u:p@localhost/waywo")
    assert not is_test_database("postgresql://u:p@localhost/waywo_test_backup")
