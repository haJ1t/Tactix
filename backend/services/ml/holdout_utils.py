"""
Holdout split utilities for match-level evaluation.
"""
from __future__ import annotations

import os
from typing import Dict, Iterable, Optional, Tuple

import pandas as pd


DEFAULT_HOLDOUT_COMPETITION = os.environ.get("TACTIX_HOLDOUT_COMP", "World Cup")
DEFAULT_HOLDOUT_SEASON = os.environ.get("TACTIX_HOLDOUT_SEASON", "2022")


def split_holdout(
    df: pd.DataFrame,
    competition_contains: Optional[str] = DEFAULT_HOLDOUT_COMPETITION,
    season_contains: Optional[str] = DEFAULT_HOLDOUT_SEASON,
    match_ids: Optional[Iterable[int]] = None,
) -> Tuple[pd.DataFrame, pd.DataFrame, Dict]:
    """
    Split a DataFrame into train/holdout sets using fixed competition/season or match_ids.

    Returns: train_df, holdout_df, info
    """
    info: Dict = {
        "enabled": False,
        "competition_contains": competition_contains,
        "season_contains": season_contains,
        "match_ids": list(match_ids) if match_ids is not None else None,
        "reason": "",
        "train_size": len(df),
        "holdout_size": 0,
        "holdout_matches": 0,
    }

    if df is None or df.empty:
        info["reason"] = "empty_dataset"
        return df, df.iloc[0:0], info

    if "match_id" not in df.columns:
        info["reason"] = "missing_match_id"
        return df, df.iloc[0:0], info

    has_comp = "competition" in df.columns
    has_season = "season" in df.columns

    if not match_ids and not (competition_contains or season_contains):
        info["reason"] = "no_holdout_criteria"
        return df, df.iloc[0:0], info

    if (competition_contains or season_contains) and not (has_comp and has_season):
        info["reason"] = "missing_competition_or_season"
        return df, df.iloc[0:0], info

    mask = pd.Series(False, index=df.index)

    if match_ids:
        mask = mask | df["match_id"].isin(list(match_ids))

    if competition_contains or season_contains:
        comp = df["competition"].fillna("") if has_comp else ""
        season = df["season"].fillna("") if has_season else ""
        comp_mask = (
            comp.str.contains(competition_contains, case=False, na=False)
            if competition_contains
            else True
        )
        season_mask = (
            season.str.contains(season_contains, case=False, na=False)
            if season_contains
            else True
        )
        mask = mask | (comp_mask & season_mask)

    holdout_df = df[mask].copy()
    train_df = df[~mask].copy()

    info["enabled"] = True
    info["train_size"] = len(train_df)
    info["holdout_size"] = len(holdout_df)
    info["holdout_matches"] = (
        int(holdout_df["match_id"].nunique()) if not holdout_df.empty else 0
    )
    info["reason"] = "ok" if not holdout_df.empty else "no_holdout_matches"

    if train_df.empty:
        # Guard against accidental full holdout
        info["reason"] = "holdout_consumed_all_data"
        return df, df.iloc[0:0], info

    return train_df, holdout_df, info
