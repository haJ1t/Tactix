"""
Report artifact API routes.
"""
from __future__ import annotations

import os

from flask import Blueprint, jsonify, request, send_file

from models import SessionLocal
from models.report_artifact import ReportArtifact
from services.report_pdf_service import ReportGenerationError, ReportPdfService, sanitize_pdf_filename

reports_bp = Blueprint('reports', __name__, url_prefix='/api/reports')
report_service = ReportPdfService()


def get_db():
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise


@reports_bp.route('', methods=['GET'])
def list_reports():
    db = get_db()
    try:
        reports = db.query(ReportArtifact).order_by(ReportArtifact.created_at.desc()).all()
        return jsonify({
            'reports': [report.to_summary_dict() for report in reports],
            'count': len(reports),
        })
    finally:
        db.close()


@reports_bp.route('/<string:report_id>', methods=['GET'])
def get_report(report_id: str):
    db = get_db()
    try:
        report = db.query(ReportArtifact).filter(ReportArtifact.id == report_id).first()
        if not report:
            return jsonify({'error': 'Report not found'}), 404
        return jsonify(report.to_detail_dict())
    finally:
        db.close()


@reports_bp.route('', methods=['POST'])
def create_report():
    db = get_db()
    try:
        payload = request.get_json() or {}
        match_id = payload.get('match_id')
        if not match_id:
            return jsonify({'error': 'match_id is required'}), 400

        artifact = report_service.create_generated_report(db, int(match_id))
        return jsonify(artifact.to_detail_dict()), 201
    except ReportGenerationError as error:
        if hasattr(db, 'rollback'):
            db.rollback()
        return jsonify({'error': str(error)}), 400
    except Exception as error:
        if hasattr(db, 'rollback'):
            db.rollback()
        return jsonify({'error': f'Report generation failed: {error}'}), 500
    finally:
        db.close()


@reports_bp.route('/import-legacy', methods=['POST'])
def import_legacy_report():
    db = get_db()
    try:
        payload = request.get_json() or {}
        legacy_report = payload.get('legacy_report')
        if not isinstance(legacy_report, dict):
            return jsonify({'error': 'legacy_report is required'}), 400

        artifact = report_service.import_legacy_report(db, legacy_report)
        return jsonify(artifact.to_detail_dict()), 201
    except ReportGenerationError as error:
        if hasattr(db, 'rollback'):
            db.rollback()
        return jsonify({'error': str(error)}), 400
    except Exception as error:
        if hasattr(db, 'rollback'):
            db.rollback()
        return jsonify({'error': f'Legacy report import failed: {error}'}), 500
    finally:
        db.close()


@reports_bp.route('/<string:report_id>/download', methods=['GET'])
def download_report(report_id: str):
    db = get_db()
    try:
        report = db.query(ReportArtifact).filter(ReportArtifact.id == report_id).first()
        if not report:
            return jsonify({'error': 'Report not found'}), 404
        if not report.pdf_path or not os.path.exists(report.pdf_path):
            return jsonify({'error': 'PDF artifact not found'}), 404

        return send_file(
            report.pdf_path,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=sanitize_pdf_filename(report.title, report.id),
        )
    finally:
        db.close()


@reports_bp.route('/<string:report_id>', methods=['DELETE'])
def delete_report(report_id: str):
    db = get_db()
    try:
        report = db.query(ReportArtifact).filter(ReportArtifact.id == report_id).first()
        if not report:
            return jsonify({'error': 'Report not found'}), 404

        report_service.delete_artifact(db, report)
        return jsonify({'id': report_id, 'deleted': True})
    finally:
        db.close()
