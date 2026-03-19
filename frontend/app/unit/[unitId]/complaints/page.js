import { getComplaintsByUnit } from "@/lib/mockData";
import styles from "./page.module.css";

export default function UnitComplaintsPage({ params }) {
  const complaints = getComplaintsByUnit(params.unitId);

  return (
    <div className={`pageShell ${styles.page}`}>
      <div>
        <h1 className="pageTitle">Unit complaints</h1>
        <p className="pageSubtitle">Complaint activity scoped to unit {params.unitId} with the same global table structure.</p>
      </div>

      <div className="tableShell">
        <table className="luxuryTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Category</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Created</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((complaint) => (
              <tr key={complaint.id}>
                <td>{complaint.id}</td>
                <td>{complaint.category}</td>
                <td>{complaint.status}</td>
                <td>{complaint.priority}</td>
                <td>{complaint.createdAt}</td>
                <td>{complaint.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
