import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  HeartHandshake,
  Info,
  Leaf,
  Lock,
  Mail,
  Send,
  ShieldCheck,
  Stethoscope,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import api from "../services/api";

const ROLE = {
  ELDER: "ELDER",
  CAREGIVER: "CAREGIVER",
  DOCTOR: "DOCTOR",
};

const THEME = {
  page: "min-h-screen bg-[#f4fbf7] text-slate-800",
  primary: "bg-emerald-700 text-white hover:bg-emerald-800",
  secondary:
    "border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50",
  card: "rounded-3xl border border-emerald-100 bg-white shadow-sm",
};

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

function getUserFromStorage() {
  const possibleKeys = ["user", "currentUser", "authUser"];

  for (const key of possibleKeys) {
    try {
      const stored = localStorage.getItem(key);

      if (!stored) continue;

      const parsed = JSON.parse(stored);
      const candidate = parsed?.user || parsed;

      if (candidate?.role) {
        return candidate;
      }
    } catch {
      // Continue checking remaining keys.
    }
  }

  return null;
}

function getRole(user) {
  return String(user?.role || "").trim().toUpperCase();
}

function getName(user) {
  return (
    user?.name ||
    user?.full_name ||
    user?.fullName ||
    user?.user?.full_name ||
    user?.user?.name ||
    "Registered user"
  );
}

function getEmail(user) {
  return user?.email || user?.user?.email || "";
}

function getStatus(status) {
  return String(status || "UNKNOWN").toUpperCase();
}

function getStatusClasses(status) {
  const value = getStatus(status);

  if (value === "APPROVED" || value === "ACTIVE") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (value === "REJECTED") {
    return "bg-rose-100 text-rose-700";
  }

  if (value === "PENDING") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-slate-100 text-slate-600";
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getResponseArray(response, key) {
  const data = response?.data;

  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.[key])) {
    return data[key];
  }

  return [];
}

function getRequestPerson(item, role) {
  if (item?.direction === "ELDER_TO_CARE_TEAM") {
    return role === ROLE.ELDER
      ? item.target || item.elder
      : item.requester;
  }

  return role === ROLE.ELDER
    ? item.requester
    : item.target || item.elder;
}

function getRequestDescription(item, role) {
  const direction = item?.direction;
  const person = getRequestPerson(item, role);
  const name = getName(person);

  if (direction === "ELDER_TO_CARE_TEAM") {
    return role === ROLE.ELDER
      ? `Invitation sent to ${name}.`
      : `${name} invited you to join their care team.`;
  }

  return role === ROLE.ELDER
    ? `${name} requested access to your care information.`
    : `Connection request sent to ${name}.`;
}

function Notice({ notice, onDismiss }) {
  if (!notice) return null;

  const isError = notice.type === "error";

  return (
    <div
      role="status"
      className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 ${
        isError
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 shrink-0" size={20} />
      ) : (
        <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
      )}

      <p className="flex-1 text-sm font-medium">{notice.message}</p>

      <button
        type="button"
        onClick={onDismiss}
        className="rounded-lg p-1 hover:bg-black/5"
        aria-label="Dismiss message"
      >
        <X size={17} />
      </button>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, subtitle, count }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Icon size={22} />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>

          {subtitle && (
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {count !== undefined && (
        <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center">
      <Users size={28} className="mx-auto mb-3 text-slate-300" />

      <p className="font-semibold text-slate-700">{title}</p>

      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}

function MyCareTeam() {
  const navigate = useNavigate();

  const [user] = useState(() => getUserFromStorage());

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState(ROLE.DOCTOR);

  const [requests, setRequests] = useState([]);
  const [members, setMembers] = useState([]);
  const [linkedElders, setLinkedElders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [notice, setNotice] = useState(null);

  const role = getRole(user);
  const isElder = role === ROLE.ELDER;
  const isCaregiver = role === ROLE.CAREGIVER;
  const isDoctor = role === ROLE.DOCTOR;

  const loadData = useCallback(async () => {
    const activeRole = getRole(user);

    if (!activeRole) {
      setRequests([]);
      setMembers([]);
      setLinkedElders([]);
      setLoading(false);

      setNotice({
        type: "error",
        message:
          "Your account information could not be loaded. Please log in again.",
      });

      return;
    }

    setLoading(true);

    try {
      const [requestResult, teamResult, eldersResult] =
        await Promise.allSettled([
          api.get("/connections/requests"),

          activeRole === ROLE.ELDER
            ? api.get("/connections/team")
            : Promise.resolve({ data: { members: [] } }),

          activeRole === ROLE.CAREGIVER
            ? api.get("/caregiver/elders")
            : Promise.resolve({ data: { elders: [] } }),
        ]);

      if (requestResult.status === "fulfilled") {
        setRequests(
          getResponseArray(requestResult.value, "requests")
        );
      } else {
        setRequests([]);

        setNotice({
          type: "error",
          message: getErrorMessage(
            requestResult.reason,
            "Could not load connection requests."
          ),
        });
      }

      if (activeRole === ROLE.ELDER) {
        if (teamResult.status === "fulfilled") {
          setMembers(
            getResponseArray(teamResult.value, "members")
          );
        } else {
          setMembers([]);

          setNotice({
            type: "error",
            message: getErrorMessage(
              teamResult.reason,
              "Could not load your verified care team."
            ),
          });
        }
      } else {
        setMembers([]);
      }

      if (activeRole === ROLE.CAREGIVER) {
        if (eldersResult.status === "fulfilled") {
          setLinkedElders(
            getResponseArray(eldersResult.value, "elders")
          );
        } else {
          setLinkedElders([]);

          setNotice({
            type: "error",
            message: getErrorMessage(
              eldersResult.reason,
              "Could not load your connected elders."
            ),
          });
        }
      } else {
        setLinkedElders([]);
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          error,
          "Unable to load connection information."
        ),
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const loadInitialData = async () => {
      if (cancelled) return;
      await loadData();
    };

    loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const sendRequest = async (event) => {
    event?.preventDefault();

    if (sending) return;

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setNotice({
        type: "error",
        message: "Enter the registered email address.",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setNotice({
        type: "error",
        message: "Enter a valid email address.",
      });
      return;
    }

    setSending(true);
    setNotice(null);

    try {
      if (isElder) {
        const searchResponse = await api.post(
          "/connections/search-elder",
          { email: cleanEmail }
        );

        const recipient = searchResponse.data?.recipient;

        if (!recipient) {
          throw new Error(
            "The registered account could not be verified."
          );
        }

        const actualRole = getRole(recipient);

        if (
          actualRole !== ROLE.CAREGIVER &&
          actualRole !== ROLE.DOCTOR
        ) {
          throw new Error(
            "This account is not a registered caregiver or doctor."
          );
        }

        if (actualRole !== inviteRole) {
          throw new Error(
            `This email belongs to a ${actualRole.toLowerCase()} account. Please select the correct role.`
          );
        }
      }

      const response = await api.post(
        "/connections/request",
        { email: cleanEmail }
      );

      setEmail("");

      setNotice({
        type: "success",
        message:
          response.data?.message ||
          (isElder
            ? "Invitation sent. Access remains restricted until the recipient accepts."
            : "Connection request sent. Access remains restricted until the elder approves."),
      });

      await loadData();
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          error,
          "Unable to send the connection request."
        ),
      });
    } finally {
      setSending(false);
    }
  };

  const decide = async (requestId, decision) => {
    if (!requestId) {
      setNotice({
        type: "error",
        message: "This request has no valid ID.",
      });
      return;
    }

    if (busyId !== null) return;

    setBusyId(requestId);
    setNotice(null);

    try {
      const response = await api.post(
        `/connections/requests/${requestId}/decision`,
        { decision }
      );

      setNotice({
        type: "success",
        message:
          response.data?.message ||
          (decision === "APPROVE"
            ? "Connection accepted successfully."
            : "Connection request rejected."),
      });

      await loadData();
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          error,
          "Unable to process this connection request."
        ),
      });
    } finally {
      setBusyId(null);
    }
  };

  // id         -> primary key of the row to delete:
  //               - request row id (pending/outgoing requests)
  //               - CaregiverElderLink / DoctorElderLink id (Elder's verified team)
  //               - elder profile id (Caregiver's connected elders)
  // isTeamMember -> true for active connections, false for connection requests
  // linkType   -> "CAREGIVER" | "DOCTOR" (only needed for the Elder's team list)
  const deleteConnection = async (id, isTeamMember = false, linkType = null) => {
    const confirmed = window.confirm(
      "Are you sure you want to remove this connection? Once deleted, access will be revoked permanently."
    );
    if (!confirmed) return;

    setBusyId(id);
    setNotice(null);

    try {
      if (isTeamMember) {
        if (isElder) {
          const type = String(linkType || "").toUpperCase();
          await api.delete(
            type
              ? `/connections/team/${type}/${id}`
              : `/connections/team/${id}`
          );
          setMembers((prev) =>
            prev.filter(
              (m) =>
                !(
                  (m.link_id ?? m.id) === id &&
                  (!type || String(m.link_type || "").toUpperCase() === type)
                )
            )
          );
        } else if (isCaregiver) {
          await api.delete(`/caregiver/elders/${id}`);
          setLinkedElders((prev) =>
            prev.filter((e) => (e.elder_id ?? e.id) !== id)
          );
        } else if (isDoctor) {
          await api.delete(`/doctor/patients/${id}`);
        }
      } else {
        // Pending / outgoing / past requests
        await api.delete(`/connections/requests/${id}/decision`);
        setRequests((prev) => prev.filter((r) => r.id !== id));
      }

      setNotice({
        type: "success",
        message: "Connection successfully removed from database.",
      });

      // Re-sync with the database so nothing stale remains on screen
      await loadData();
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error, "Unable to delete this connection."),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/dashboard");
    }
  };

  const incomingRequests = requests.filter((item) => {
    if (getStatus(item.status) !== "PENDING") {
      return false;
    }

    if (
      isElder &&
      item.direction === "CARE_TEAM_TO_ELDER"
    ) {
      return true;
    }

    if (
      (isCaregiver || isDoctor) &&
      item.direction === "ELDER_TO_CARE_TEAM"
    ) {
      return true;
    }

    return false;
  });

  const outgoingRequests = requests.filter((item) => {
    if (isElder) {
      return item.direction === "ELDER_TO_CARE_TEAM";
    }

    if (isCaregiver || isDoctor) {
      return item.direction === "CARE_TEAM_TO_ELDER";
    }

    return false;
  });

  const pageTitle = isElder
    ? "Protected Health Network"
    : isDoctor
      ? "Doctor Care Connections"
      : "Caregiver Connections";

  const pageSubtitle = isElder
    ? "Manage the people authorized to support your healthcare."
    : isDoctor
      ? "Review invitations and manage your authorized elder connections."
      : "Review invitations and manage your connected elders.";

  if (!user || !role) {
    return (
      <div className={THEME.page}>
        <div className="mx-auto max-w-xl px-5 py-16">
          <div className={`${THEME.card} p-8 text-center`}>
            <AlertCircle
              size={34}
              className="mx-auto mb-4 text-amber-600"
            />

            <h1 className="text-xl font-bold">
              Account information unavailable
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Please sign in again before managing care connections.
            </p>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className={`mt-6 rounded-xl px-5 py-3 font-semibold ${THEME.primary}`}
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={THEME.page}>
      <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-800"
              aria-label="Back to previous page"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md">
              <HeartHandshake size={23} />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight text-slate-800 sm:text-xl">
                My Care Team
              </h1>

              <p className="hidden text-xs text-slate-500 sm:block">
                Elder Sense · Protected connections
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {role}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        <section className="relative mb-7 overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 p-6 text-white shadow-lg sm:p-9">
          <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full border-[28px] border-white/5" />
          <div className="pointer-events-none absolute -bottom-20 right-32 h-48 w-48 rounded-full bg-white/5" />

          <div className="relative z-10 max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-50">
              <ShieldCheck size={15} />
              Secure care connections
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
              {pageTitle}
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50 sm:text-base">
              {pageSubtitle}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-medium text-emerald-50">
              <span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                <Lock size={15} />
                Approval required
              </span>

              <span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                <Activity size={15} />
                Role-based access
              </span>
            </div>
          </div>
        </section>

        <Notice
          notice={notice}
          onDismiss={() => setNotice(null)}
        />

        <section className={`${THEME.card} mb-7 p-5 sm:p-7`}>
          <SectionHeading
            icon={isElder ? HeartHandshake : Mail}
            title={
              isElder
                ? "Connect With Your Care Team"
                : "Connect With an Elder"
            }
            subtitle={
              isElder
                ? "Invite a registered caregiver or doctor using their account email."
                : "Send a connection request using the elder's registered email address."
            }
          />

          <form
            onSubmit={sendRequest}
            className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_1.4fr_auto]"
          >
            {isElder && (
              <div>
                <label
                  htmlFor="recipientRole"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Care-team member
                </label>

                <select
                  id="recipientRole"
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(event.target.value)
                  }
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value={ROLE.DOCTOR}>Doctor</option>
                  <option value={ROLE.CAREGIVER}>Caregiver</option>
                </select>
              </div>
            )}

            <div className={isElder ? "" : "md:col-span-2"}>
              <label
                htmlFor="connectionEmail"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Registered email address
              </label>

              <div className="relative">
                <Mail
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="connectionEmail"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder={
                    isElder
                      ? "Enter doctor's or caregiver's email"
                      : "Enter elder's email"
                  }
                  autoComplete="email"
                  required
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={sending}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${THEME.primary}`}
            >
              {sending ? (
                <span className="animate-pulse">Sending…</span>
              ) : (
                <>
                  <Send size={17} />
                  Send Invitation
                </>
              )}
            </button>
          </form>

          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-emerald-50/80 p-4">
            <Info
              size={19}
              className="mt-0.5 shrink-0 text-emerald-700"
            />

            <p className="text-xs leading-6 text-slate-600">
              {isElder
                ? "The selected account's registered role is checked before the invitation is sent. The doctor or caregiver must accept before a connection becomes active."
                : "The elder must approve your request before you can access their protected health information."}
            </p>
          </div>
        </section>

        <section className={`${THEME.card} mb-7 p-5 sm:p-7`}>
          <SectionHeading
            icon={Clock}
            title={
              isElder
                ? "Pending Authorizations"
                : "Incoming Invitations"
            }
            subtitle={
              isElder
                ? "Review caregivers and doctors requesting access."
                : "Review elder invitations and choose whether to accept or reject them."
            }
            count={incomingRequests.length}
          />

          {loading && (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
              Loading connection requests…
            </div>
          )}

          {!loading && incomingRequests.length === 0 && (
            <EmptyState
              title="No pending invitations"
              description={
                isElder
                  ? "Caregiver and doctor requests requiring your approval will appear here."
                  : "When an elder invites you to join their care team, the invitation will appear here."
              }
            />
          )}

          {!loading && incomingRequests.length > 0 && (
            <div className="space-y-4">
              {incomingRequests.map((item) => {
                const person = getRequestPerson(item, role);
                const isBusy = busyId === item.id;

                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                          {getRole(person) === ROLE.DOCTOR ? (
                            <Stethoscope size={22} />
                          ) : (
                            <User size={22} />
                          )}
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-800">
                            {getName(person)}
                          </h3>

                          <p className="mt-1 break-all text-sm text-slate-500">
                            {getEmail(person) || "Email unavailable"}
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {getRequestDescription(item, role)}
                          </p>

                          <p className="mt-2 text-xs text-slate-400">
                            Received: {formatDate(item.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-bold ${getStatusClasses(
                            item.status
                          )}`}
                        >
                          {getStatus(item.status)}
                        </span>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => deleteConnection(item.id, false)}
                          className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition shadow-sm"
                          title="Delete request"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {getStatus(item.status) === "PENDING" && (
                      <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          disabled={isBusy || busyId !== null}
                          onClick={() => decide(item.id, "APPROVE")}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60"
                        >
                          <Check size={17} />
                          {isBusy ? "Processing…" : "Accept"}
                        </button>

                        <button
                          type="button"
                          disabled={isBusy || busyId !== null}
                          onClick={() => decide(item.id, "REJECT")}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                        >
                          <X size={17} />
                          Reject
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {isElder && (
          <section className={`${THEME.card} mb-7 p-5 sm:p-7`}>
            <SectionHeading
              icon={ShieldCheck}
              title="Verified Care Network"
              subtitle="Caregivers and doctors with active connections to your account."
              count={members.length}
            />

            {loading && (
              <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                Loading your verified care team…
              </div>
            )}

            {!loading && members.length === 0 && (
              <EmptyState
                title="Your verified care team is empty"
                description="Send an invitation above. A caregiver or doctor will appear here after accepting your invitation."
              />
            )}

            {!loading && members.length > 0 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {members.map((member, index) => {
                  const memberRole = getRole(member);
                  // Real primary key of the CaregiverElderLink / DoctorElderLink row
                  const memberId = member.link_id ?? member.id ?? member.user_id ?? index;
                  const memberLinkType = member.link_type || memberRole;

                  return (
                    <article
                      key={`${memberLinkType}-${memberId}`}
                      className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/50 p-5 relative group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                          {memberRole === ROLE.DOCTOR ? (
                            <Stethoscope size={23} />
                          ) : (
                            <HeartHandshake size={23} />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-slate-800">
                            {getName(member)}
                          </h3>

                          <p className="mt-1 break-all text-sm text-slate-500">
                            {getEmail(member)}
                          </p>

                          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-emerald-800">
                            {memberRole || "CARE TEAM MEMBER"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <CheckCircle2
                            size={21}
                            className="shrink-0 text-emerald-600"
                            aria-label="Active connection"
                          />

                          <button
                            type="button"
                            onClick={() => deleteConnection(memberId, true, memberLinkType)}
                            className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition shadow-sm"
                            title="Remove / Delete Connection"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {member.specialization && (
                        <p className="mt-3 text-sm text-slate-600">
                          <span className="font-semibold">
                            Specialization:
                          </span>{" "}
                          {member.specialization}
                        </p>
                      )}

                      {member.hospital && (
                        <p className="mt-1 text-sm text-slate-600">
                          <span className="font-semibold">Hospital:</span>{" "}
                          {member.hospital}
                        </p>
                      )}

                      {member.relationship && (
                        <p className="mt-1 text-sm text-slate-600">
                          <span className="font-semibold">
                            Relationship:
                          </span>{" "}
                          {member.relationship}
                        </p>
                      )}

                      <div className="mt-4 border-t border-emerald-100 pt-3 flex items-center justify-between">
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800">
                          <Lock size={14} />
                          Active connection
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {isCaregiver && (
          <section className={`${THEME.card} mb-7 p-5 sm:p-7`}>
            <SectionHeading
              icon={Users}
              title="Connected Elders"
              subtitle="Elders linked to your caregiver account."
              count={linkedElders.length}
            />

            {loading && (
              <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                Loading connected elders…
              </div>
            )}

            {!loading && linkedElders.length === 0 && (
              <EmptyState
                title="No active elder connections"
                description="Accept an elder's invitation or wait for an elder to approve your connection request."
              />
            )}

            {!loading && linkedElders.length > 0 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {linkedElders.map((elder, index) => {
                  const elderId =
                    elder.elder_id ??
                    elder.elder?.id ??
                    elder.id;

                  const elderName =
                    elder.elder_name ||
                    elder.name ||
                    elder.full_name ||
                    elder.elder?.full_name ||
                    elder.elder?.name ||
                    `Elder ${elderId ?? index + 1}`;

                  return (
                    <article
                      key={elderId ?? index}
                      className="rounded-2xl border border-emerald-100 bg-white p-5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                          <User size={23} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-slate-800">
                            {elderName}
                          </h3>

                          <p className="mt-1 break-all text-sm text-slate-500">
                            {elder.email || elder.elder?.email || ""}
                          </p>

                          <div className="mt-3 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                              <CheckCircle2 size={13} />
                              Connected
                            </span>

                            <button
                              type="button"
                              onClick={() => deleteConnection(elderId, true)}
                              className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition shadow-sm"
                              title="Disconnect / Remove Elder"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {elderId != null && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/caregiver/elder/${elderId}`)
                          }
                          className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-bold transition ${THEME.primary}`}
                        >
                          Open Elder Dashboard
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {isDoctor && (
          <section className={`${THEME.card} mb-7 p-5 sm:p-7`}>
            <SectionHeading
              icon={Stethoscope}
              title="Doctor Access"
              subtitle="Manage requests from elders and review connection status."
            />

            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  size={23}
                  className="mt-0.5 shrink-0 text-blue-700"
                />

                <div>
                  <h3 className="font-bold text-slate-800">
                    Protected patient information
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    An elder's invitation must be accepted before the
                    connection becomes active. Patient information should
                    only be available through backend routes that verify
                    the doctor's active authorization.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className={`${THEME.card} mb-7 p-5 sm:p-7`}>
          <SectionHeading
            icon={Activity}
            title="Connection History"
            subtitle="Review connection requests sent from your account."
            count={outgoingRequests.length}
          />

          {loading && (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
              Loading request history…
            </div>
          )}

          {!loading && outgoingRequests.length === 0 && (
            <EmptyState
              title="No outgoing requests yet"
              description="Requests sent from your account will appear here with their current status."
            />
          )}

          {!loading && outgoingRequests.length > 0 && (
            <div className="space-y-3">
              {outgoingRequests.map((item) => {
                const person = getRequestPerson(item, role);

                return (
                  <article
                    key={item.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                        {isElder ? (
                          <HeartHandshake size={19} />
                        ) : (
                          <Mail size={19} />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">
                          {getName(person)}
                        </p>

                        <p className="mt-1 break-all text-sm text-slate-500">
                          {getEmail(person)}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {formatDate(item.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-auto">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${getStatusClasses(
                          item.status
                        )}`}
                      >
                        {getStatus(item.status)}
                      </span>

                      <button
                        type="button"
                        onClick={() => deleteConnection(item.id, false)}
                        className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition shadow-sm"
                        title="Cancel / Delete Request"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck
              size={21}
              className="mt-0.5 shrink-0 text-emerald-800"
            />

            <div>
              <h3 className="font-bold text-emerald-900">
                Your health information stays protected
              </h3>

              <p className="mt-2 text-sm leading-6 text-emerald-900/80">
                A connection request alone does not grant access. The
                appropriate recipient must approve the request, and
                protected backend routes must continue checking the
                active caregiver or doctor relationship.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-8 flex flex-col items-center justify-center gap-2 pb-5 text-center text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Leaf size={15} className="text-emerald-600" />
            <span>Elder Sense · Care with confidence</span>
          </div>

          <p>
            Connection information is loaded from your authenticated
            Elder Sense account.
          </p>
        </footer>
      </main>
    </div>
  );
}

export default MyCareTeam;