from main import RUN_MODE_TEST, main


if __name__ == "__main__":
    main(
        run_mode=RUN_MODE_TEST,
        allow_ble=False,
        enable_tester_console=True,
        enable_tester_boot_window=False,
    )
